#!/usr/bin/env python3
"""Rebuild a provenance-preserving experimental research database, offline.
No source is a calibrated model. Noncommercial inputs require explicit opt-in.
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import sqlite3
import sys
import tempfile
import os
import re
from datetime import date
from collections import Counter, defaultdict
from xlsx_reader import Workbook

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-data/calibration'
VERSION = 'experimental-base-1.0.0'
COUNTRIES = ['TGO', 'BEN', 'BFA', 'GHA', 'CIV', 'SEN']
CROPS = {'Maize':'maize', 'Soybean':'soybean', 'Cowpea':'cowpea', 'Groundnut':'groundnut', 'Fallow':'fallow', 'Tomato':'tomato', 'Lettuce':'lettuce', 'Carrot':'carrot'}
MISSING = {'', 'NA', 'N/A', 'NAN', 'NULL', 'NONE', 'ND'}


def dumps(v):
    return json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def stable(*parts):
    return hashlib.sha256(dumps(parts).encode()).hexdigest()[:24]


def number(v):
    if v is None or isinstance(v, bool) or str(v).strip().upper() in MISSING:
        return None
    try:
        n = float(v)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError):
        return None


def valid_date(v):
    try:
        # WoSIS also supplies unpadded ISO calendar dates (1997-9-1).
        if not re.fullmatch(r'\d{4}-\d{1,2}-\d{1,2}',str(v)):return None
        return date(*map(int,str(v).split('-'))).isoformat()
    except (ValueError, TypeError):
        return None


class Builder:
    def __init__(self, output, research=False):
        self.out = Path(output)
        self.out.mkdir(parents=True, exist_ok=True)
        final_path = self.out/'experimental.sqlite'
        if final_path.exists():
            raise ValueError('Output already exists; choose a new directory (no database overwritten).')
        fd,temporary=tempfile.mkstemp(prefix='.experimental-building-',suffix='.sqlite',dir=self.out)
        os.close(fd);self.path=Path(temporary)
        self.db = sqlite3.connect(self.path)
        self.db.row_factory = sqlite3.Row
        self.db.executescript((DATA/'schema.sql').read_text())
        self.research = research
        self.manifest = json.loads((DATA/'manifest.json').read_text())
        self.registry = json.loads((ROOT/'docs/calibration/REGISTRE_SOURCES.json').read_text())
        self.raw = {}
        self.file_ids = {}
        self.loaded_files = []
        self.put('metadata', key='version', value=VERSION)
        self.put('metadata', key='purpose', value='noncommercial_research' if research else 'open_context_only')
        self.put('metadata', key='calibrated_countries', value='[]')
        for s in self.registry['sources']:
            self.put('sources', id=s['id'], title=s['title'], owner=s['owner'], url=s['url'], licence=s['licence'], version=s.get('version'), published_at=s.get('published_at'), access_state=s['access_state'], details_json=dumps(s))

    def put(self, table, **row):
        # Table and column names are internal constants, never imported identifiers.
        columns = ','.join('"'+k+'"' for k in row)
        values = list(row.values())
        self.db.execute(f'INSERT INTO "{table}" ({columns}) VALUES ({",".join("?" for _ in row)})', values)
        return row.get('id')

    def entity(self, table, **row):
        old = self.db.execute(f'SELECT * FROM "{table}" WHERE id=?', (row['id'],)).fetchone()
        if old:
            if any(old[k] != v for k, v in row.items()):
                raise ValueError(f'Conflicting entity {table}/{row["id"]}')
            return row['id']
        return self.put(table, **row)

    def issue(self, code, record, message, field=None, severity='review'):
        self.put('qc_issues', severity=severity, code=code, record_id=record, field=field, message=message)

    def read_file(self, spec):
        if 'NC' in spec['licence' if 'licence' in spec else 'license'] and not self.research:
            return None
        path = ROOT/spec['path']
        if not path.is_file():raise ValueError('Source not acquired locally: '+spec['path']+'. Use acquire.py with explicit licensed research opt-in; restricted originals are not redistributed.')
        b = path.read_bytes()
        if len(b) != spec['bytes'] or hashlib.sha256(b).hexdigest() != spec['sha256']:
            raise ValueError('Checksum/size mismatch: '+spec['path'])
        fid = stable(spec['source_id'], spec['sha256'])
        self.put('source_files', id=fid, source_id=spec['source_id'], path=spec['path'], sha256=spec['sha256'], bytes=len(b), licence=spec['license'], acquired_at=spec['acquired_at'], details_json=dumps(spec))
        self.file_ids[spec['path']] = fid
        self.loaded_files.append(spec)
        return path

    def stage_workbook(self, spec, path):
        wb = Workbook(path)
        out = {}
        for sheet in wb.sheets:
            raw = list(wb.rows(sheet))
            if not raw:
                continue
            sid = stable(self.file_ids[spec['path']], sheet)
            self.put('sheets', id=sid, file_id=self.file_ids[spec['path']], name=sheet, headers_json=dumps(raw[0][1]))
            for n, vals in raw:
                rid = stable(sid, n)
                self.put('source_rows', id=rid, sheet_id=sid, source_row=n, raw_json=dumps(vals), fingerprint=hashlib.sha256(dumps(vals).encode()).hexdigest())
                self.raw[(spec['path'], sheet, n)] = rid
            # README is retained as metadata; never counted as experimental rows.
            if sheet.strip().lower() not in ['readme', 'legend']:
                out[sheet.strip()] = list(wb.records(sheet))
        wb.close()
        return out

    def stage_csv(self, spec, path):
        with path.open(newline='', encoding='utf-8-sig') as f:
            r = csv.DictReader(f)
            sid = stable(self.file_ids[spec['path']], 'CSV')
            self.put('sheets', id=sid, file_id=self.file_ids[spec['path']], name='CSV', headers_json=dumps(r.fieldnames))
            rows = []
            for n, row in enumerate(r, 2):
                rid = stable(sid, n)
                self.put('source_rows', id=rid, sheet_id=sid, source_row=n, raw_json=dumps(row), fingerprint=hashlib.sha256(dumps(row).encode()).hexdigest())
                self.raw[(spec['path'], 'CSV', n)] = rid
                rows.append((n, row))
            return rows

    def rid(self, spec, sheet, n):
        return self.raw[(spec['path'], sheet, n)]

    def site_trial(self, source, country, name, lat, lon, design, background, system):
        sid = source+':site'
        self.entity('sites', id=sid, country=country, name=name, latitude=lat, longitude=lon, coordinate_support='published experimental site, not individual plot corners', system=system, source_id=source)
        tid = source+':trial'
        self.entity('trials', id=tid, site_id=sid, design=design, background_json=dumps(background), dependency_group=sid, source_id=source)
        return sid, tid

    def plot(self, trial, label, treatment, replicate, area, control=False, control_definition='', assignment=None, randomized_blocks=True):
        tr = stable(trial, treatment)
        self.entity('treatments', id=tr, trial_id=trial, source_label=treatment, is_control=int(control), control_definition=control_definition, assignment_json=dumps(assignment or {}))
        block = stable(trial, 'block', replicate) if randomized_blocks and replicate is not None else None
        if block:
            self.entity('blocks', id=block, trial_id=trial, source_label=str(replicate))
        pid = stable(trial, label)
        self.entity('plots', id=pid, trial_id=trial, block_id=block, treatment_id=tr, source_label=label, experimental_area_m2=area, sown_area_m2=None, harvested_area_m2=None, replication_basis='randomized block' if block else 'fully randomized plot; suffix is replicate label, not a block')
        return pid, tr

    def campaign(self, plot, year, season, crop, variety, source, rowid, sow=None, harvest=None, precision='year and source cycle'):
        vid = stable(source, crop, variety)
        self.entity('crop_varieties', id=vid, crop=crop, variety=variety, source_id=source)
        group = self.db.execute('SELECT t.dependency_group FROM plots p JOIN trials t ON t.id=p.trial_id WHERE p.id=?', (plot,)).fetchone()[0]
        cid = stable(plot, year, season)
        self.entity('campaigns', id=cid, plot_id=plot, variety_id=vid, year=int(year), season=season, sowing_date=sow, harvest_date=harvest, date_precision=precision, source_row_id=rowid, dependency_group=group, synthetic=0)
        return cid

    def measurement(self, profile, parameter, value, unit, method, field, available=None, status='reported_measured'):
        n = number(value)
        if n is None and value is not None and str(value).strip().upper() not in MISSING:
            self.issue('NON_NUMERIC_SOIL_VALUE',profile,'Non-numeric source value retained, no inferred number.',field,'error');status='quarantined'
        if n is not None and ((parameter.startswith('pH') and not 0 <= n <= 14) or not parameter.startswith('pH') and n < 0):
            self.issue('IMPOSSIBLE_SOIL_VALUE', profile, 'Original retained; measurement quarantined.', field, 'error')
            status = 'quarantined'; n = None
        self.put('soil_measurements', id=stable(profile, field), profile_id=profile, parameter=parameter, value=n, unit=unit, analytical_method=method, status='missing' if n is None and status!='quarantined' else status, original_value=None if value is None else str(value), source_field=field, lower_class_bound=None, upper_class_bound=None, available_on=available)

    def import_gagnoa(self, spec, tables):
        source = spec['source_id']
        site, trial = self.site_trial(source, 'CIV', 'Gagnoa / IDESSA-CNRA', 6.133333333333333, -5.933333333333334, 'randomized blocks; 12 treatments × 8 replicates; repeated permanent plots', {'reference':'C0N0 is without mineral N and compost, with common P/K/S and dolomite; not zero fertilizer', 'N_assignment_unit':'kg N/ha/year, allocation between crop cycles unresolved', 'basal_initial':{'P2O5_kg_ha':250,'K2O_kg_ha':200,'S_kg_ha':30}, 'subsequent_source_protocol':'100 kg P2O5/ha and 100 kg K2O/ha at sowing; do not interpret as independently randomized P or K doses'}, 'rainfed maize and legume succession, old experimental station')
        compost_assay = source+':compost1973'
        self.put('product_analyses', id=compost_assay, trial_id=trial, year=1973, crop=None, product='crop-residue compost', sampled_on=None, composition_json=dumps({'N':{'value':24,'unit':'g/kg DM'},'P':{'value':7.2,'unit':'g/kg DM'},'K':{'value':18,'unit':'g/kg DM'},'C':{'value':293,'unit':'g/kg DM'}}), method_json=dumps({'source':'Cardinael et al. 2022, section 2.2, measurement from 1973 only; never extended to other years'}), source_row_id=None)
        plot_ids = {}
        campaigns = []
        annual_n = set()
        compost_annual = defaultdict(float)
        for n, r in tables['Yield']:
            rid = self.rid(spec, 'Yield', n)
            crop = CROPS.get(r.get('Crop'))
            if crop is None:
                self.issue('UNRECOGNIZED_CROP', rid, 'Source Crop value is not a crop; original row kept in staging.', 'Crop', 'error');continue
            year, rep, label = int(r['Date']), int(r['Replicate']), str(r['ID'])
            pid, treatment = self.plot(trial, label+':'+str(rep), label, rep, 43.2, control=r['Treat_Compost_tDM']==0 and r['Treat_Fertilizer_kgN']==0, control_definition='No mineral N or compost; common PK/S/dolomite background', assignment={'mineral_N_value':r['Treat_Fertilizer_kgN'],'mineral_N_unit':'kg N/ha/year','compost_assignment':r['Treat_Compost_tDM'],'compost_assignment_unit':'t DM/ha/year'})
            plot_ids[(label, rep)] = (pid, treatment)
            cid = self.campaign(pid, year, str(r['Cycle']), crop, str(r['Variety']), source, rid)
            campaigns.append((cid, pid, year, str(r['Cycle'])))
            y = number(r['Grain_yield'])
            status = 'not_cropped' if crop=='fallow' else 'missing' if y is None else 'reported_measured'
            if y is not None and (y < 0 or y > 100):
                self.issue('IMPOSSIBLE_YIELD', rid, 'Yield outside conservative review bounds; not used.', 'Grain_yield', 'error');y=None;status='quarantined'
            self.put('harvests', id=stable(cid, 'grain'), campaign_id=cid, event_label='grain', harvested_on=None, organ='grain' if crop=='maize' else 'seed' if crop!='fallow' else 'none', product_basis='grain_at_reference_moisture' if crop=='maize' else 'source product basis unresolved', moisture_percent=15 if crop=='maize' else None, area_m2=None, denominator='source_hectare_unspecified_sown_or_harvested', yield_value=y, yield_unit='t/ha', yield_kg_ha=y*1000 if y is not None else None, mass_kg=None, status=status, source_row_id=rid)
            # One annual assignment per physical plot, never duplicated per cycle.
            key = (pid, year)
            if key not in annual_n:
                annual_n.add(key)
                self.put('interventions', id=stable(pid, year, 'N-assignment'), plot_id=pid, campaign_id=None, year=year, season=None, date=None, date_precision='annual assignment; exact dates and cycle allocation unresolved', kind='mineral_fertilizer', product='urea (source protocol; product N fraction not provided)', dose=number(r['Treat_Fertilizer_kgN']), unit='kg N/ha/year', dose_basis='assigned_nutrient_N_not_commercial_product_mass', composition_id=None, application_method='source reports split at sowing and 45 days after sowing; split fractions unknown', application_depth_cm=None, status='assigned_unknown_realization', source_row_id=rid)
            compost = number(r['Compost_tDM'])
            self.put('interventions', id=stable(cid, 'compost'), plot_id=pid, campaign_id=cid, year=year, season=str(r['Cycle']), date=None, date_precision='year and cycle only', kind='organic_fertilizer', product='crop-residue compost', dose=compost*1000 if compost is not None else None, unit='kg DM/ha/cycle', dose_basis='reported_applied_dry_matter', composition_id=compost_assay if year==1973 else None, application_method=None, application_depth_cm=None, status='reported_applied' if compost is not None else 'unknown', source_row_id=rid)
            if compost is not None:compost_annual[(pid,year,r['Treat_Compost_tDM'])]+=compost
            for field, unit in [('Straw_DM','t DM/ha'),('Compost_tC','t C/ha'),('Root_DM','t DM/ha')]:
                self.put('plant_observations', id=stable(cid, field), campaign_id=cid, observed_on=None, parameter=field, value=number(r.get(field)), original_value=str(r.get(field)), unit=unit, method='reported source; Root_DM is estimated, not a direct root measurement' if field=='Root_DM' else 'reported source', sampling_unit='experimental plot', source_row_id=rid)
        first_varieties=[dict(r) for r in self.db.execute("SELECT v.variety,count(*) AS n FROM campaigns c JOIN crop_varieties v ON v.id=c.variety_id JOIN plots p ON p.id=c.plot_id WHERE p.trial_id=? AND c.season='First' GROUP BY v.variety",(trial,))]
        if len(first_varieties)>1:self.issue('CULTIVAR_PROTOCOL_CONFLICT',trial,'Paper says first-cycle H507 throughout; workbook contains '+dumps(first_varieties)+'. Source varieties kept, no cultivar effect isolated from year.')
        self.issue('DOSE_PERIOD_UNRESOLVED', trial, 'N treatment labelled per year; no invented allocation to individual crop cycles. Common P/K background is not an NPK dose-response design.')
        for (pid, year, nominal), actual in compost_annual.items():
            if nominal and actual>float(nominal)+.001:
                self.issue('COMPOST_PERIOD_PROTOCOL_CONFLICT', stable(pid,year), 'Sum of reported cycle compost exceeds the nominal annual label; both are preserved, no automatic correction.')
        methods = {'Corg_mg_g':('organic_C','g/kg','Walkley-Black; source paper section 2.3'), 'Ntot_mg_g':('total_N','g/kg','not reported in the dataset; not mineral available N'), 'pH_water':('pH_water','pH','water; suspension ratio not established'), 'pH_KCl':('pH_KCl','pH','KCl; concentration/ratio not established'), 'P_tot_mg_kg':('total_P','mg/kg','not established'), 'P_ass_mg_kg':('extractable_P','mg/kg','extractant not established; not merged with Olsen/Bray/Mehlich'), 'K_ech_cmole_kg':('exchangeable_K','cmol/kg','not established'), 'CEC_cmole_kg':('CEC','cmol/kg','not established')}
        soil_by_key = {}
        for n, r in tables['Soil']:
            rid = self.rid(spec, 'Soil', n);year=int(r['Date']);composite=year==1993 or r['Replicate']=='Composite'
            key=(str(r['ID']), int(r['Replicate']) if not composite else None)
            pid,tr = plot_ids.get(key,(None,None))
            if composite:pid=None;tr=stable(trial,str(r['ID']))
            profile=stable(rid,'soil')
            self.put('soil_profiles', id=profile, site_id=site, plot_id=pid, treatment_id=tr, year=year, sampled_on=None, sampling_phase='January/February before first crop; source paper' if not composite else 'post-experiment treatment composite', upper_cm=0, lower_cm=20, sampling_support='treatment composite across eight replicates' if composite else 'source replicate-labelled topsoil sample; paper/file counts disagree for 1971/1974/1975', source_row_id=rid, licence=spec['license'])
            for field,(parameter,unit,method) in methods.items():self.measurement(profile,parameter,r.get(field),unit,method,field,spec['published_at'])
            if not composite and pid:soil_by_key[(pid,year)]=profile
        self.issue('SOIL_REPLICATE_PROTOCOL_CONFLICT',trial,'Paper describes six replicates in early soil sampling years; file contains eight for the four treatments. Keep source labels, require clarification.')
        for cid,pid,year,season in campaigns:
            if (pid,year) in soil_by_key:
                self.put('campaign_soil_links', campaign_id=cid, profile_id=soil_by_key[(pid,year)], temporal_basis='same year pre-first-cycle sampling reported in paper', predictor_eligible=0, reason='Laboratory result availability date unknown; no backward fill and no 1993 composite linked to an individual plot.')
        for name, variable, unit, step in [('Rainfall','rain','mm','day'),('Max_air_temperature','air_temperature_max_monthly_mean','°C','month'),('Min_air_temperature','air_temperature_min_monthly_mean','°C','month')]:
            series=stable(site,name);self.put('weather_series',id=series,site_id=site,variable=variable,unit=unit,time_step=step,spatial_support='experimental station, not plot sensor',source_id=source)
            if name=='Rainfall':
                for n,r in tables[name]:
                    period=valid_date(r['Date']);v=number(r['Rainfall_mm']);rid=self.rid(spec,name,n)
                    if not period:self.issue('WEATHER_DATE_INVALID',rid,'No date invented.',severity='error');continue
                    if v is not None and not 0<=v<=2000:self.issue('WEATHER_VALUE_INVALID',rid,'Rain quarantined.',severity='error');v=None
                    self.put('weather_observations',id=stable(series,period),series_id=series,period=period,value=v,status='missing' if v is None else 'reported_observed',source_row_id=rid)
            else:
                # First column has no header in the source; preserve year, keep monthly means monthly.
                for n,r in tables[name]:
                    year=r['_column_1']
                    for month,(field,v) in enumerate([(k,v) for k,v in r.items() if k!='_column_1'],1):
                        if month>12:break
                        value=number(v)
                        self.put('weather_observations',id=stable(series,year,month),series_id=series,period=f'{int(year):04d}-{month:02d}',value=value,status='missing' if value is None else 'reported_monthly_mean',source_row_id=self.rid(spec,name,n))
        self.issue('YIELD_DENOMINATOR_UNRESOLVED',trial,'43.2 m² is experimental plot area; source does not establish a sown-vs-harvested hectare denominator or net harvested area. No production mass derived.')
        self.issue('WEATHER_FOR_WATER_MODEL_INCOMPLETE',trial,'Daily rain and monthly temperature available, but daily ET0, radiation, wind and irrigation history are not established.')

    def import_wosis(self, spec, records):
        for n,r in records:
            rid=self.rid(spec,'CSV',n);lic=r['licence']
            if 'NonCommercial' in lic or 'BY-NC' in lic:
                raise ValueError('A noncommercial WoSIS row entered the open snapshot')
            lat,lon=number(r['latitude']),number(r['longitude'])
            if lat is None or lon is None or not -90<=lat<=90 or not -180<=lon<=180:
                self.issue('COORDINATES_INVALID',rid,'Profile retained only in staging.',severity='error');continue
            site='wosis:'+r['profile_id'];self.entity('sites',id=site,country=r['country'],name=r['profile_code'],latitude=lat,longitude=lon,coordinate_support=r['positional_uncertainty'] or 'unknown',system=None,source_id=spec['source_id'])
            top,bottom=number(r['upper_depth']),number(r['lower_depth'])
            if top is not None and bottom is not None and not 0<=top<bottom:
                self.issue('SOIL_DEPTH_INVALID',rid,'Profile retained only in staging.',severity='error');continue
            profile=stable(site,r['layer_id']);d=valid_date(r['date']);year=re.match(r'^(\d{4})-',r['date'])
            self.put('soil_profiles',id=profile,site_id=site,plot_id=None,treatment_id=None,year=int(year[1]) if year else None,sampled_on=d,sampling_phase=None,upper_cm=top,lower_cm=bottom,sampling_support='soil profile horizon, no experimental treatment link',source_row_id=rid,licence=lic)
            self.measurement(profile,'pH_water',r['value_avg'],'pH',r['method_options'],'value_avg',spec['acquired_at'][:10],status='spectral_estimate' if 'spectral = [ true ]' in r['method_options'] else 'reported_standardized')
        self.issue('CONTEXT_NOT_EXPERIMENT',spec['source_id'],'WoSIS pH horizons have no randomized fertilizer treatments or linked yields; no nearest-point attachment to experimental plots.')

    def import_ofra(self,spec,records):
        seen=Counter()
        for n,r in records:
            rid=self.rid(spec,'CSV',n);key=(r['country'],r['source_id_text'],r['nutrient']);seen[key]+=1
            conv=lambda v:None if number(v) in (-9,-999) else number(v)
            self.put('response_functions',id=stable(rid,'function'),country=r['country'],crop=r['crop'],nutrient=r['nutrient'],year_text=r['year_text'],source_identifier=r['source_id_text'],latitude=conv(r['latitude']),longitude=conv(r['longitude']),a=conv(r['coefficient_a']),b=conv(r['coefficient_b']),c=conv(r['coefficient_c']),coefficient_units=None,original_json=r['raw_values_json'],source_row_id=rid,excluded_from_plot_calibration=1)
        for key,count in seen.items():
            if count>1:self.issue('OFRA_REUSED_IDENTIFIER',stable(*key),f'{count} rows share a source identifier; do not count as independent experimental plots.')
        self.issue('FITTED_FUNCTION_NOT_PLOT',spec['source_id'],'Rows are fitted response functions, not raw plot × season observations. Formula units, depth and NPK background are not reconstructed from coefficients. SOM-derived SOC is not a measured carbon analysis.')

    def import_variety_context(self,spec,records):
        for n,r in records:
            self.put('context_observations',id=stable(spec['source_id'],n),country='TGO',crop='maize',observation_kind='varietal trial record; replication and fertilizer dose absent',details_json=dumps(r),source_row_id=self.rid(spec,'CSV',n),excluded_from_plot_calibration=1)
        self.issue('NO_FERTILIZER_DESIGN',spec['source_id'],'Varietal yields lack fertilizer rate and replicate identifiers; not fertilizer calibration labels. Unit is not guessed from the YIELD header.')

    def readme(self, spec):
        wb=Workbook(ROOT/spec['path'])
        out=wb.metadata_dictionary()
        wb.close()
        return out

    def import_senegal(self, bundles):
        source='cirad-soere-senegal'
        site,trial=self.site_trial(source,'SEN','SOERE PRO / ISRA Sangalkam',14+47/60+34/3600,-(17+13/60+30/3600),'fully randomized; 7 treatments × 3 plots; 6 cropping beds are subsamples, not replicates',{'control':'SF100 synthetic fertilizer reference, not an unfertilized control','treatments':['D100','D200','PL100','PL200','SS100','SS200','SF100'],'gross_plot_m2':64,'cropped_beds_m2':48,'bed_m2':8,'pesticide_protocol':'no pesticides reported by source article; not a pesticide-response trial'},'irrigated market gardening; tomato/lettuce/carrot succession, site-specific')
        by_number={Path(spec['path']).name.split('_')[0]:(spec,tables) for spec,tables in bundles}
        management_spec,mt=by_number['3'];management={}
        for n,r in mt['data_MANAGEMENT']:
            key=(int(r['Year']),str(r['Cycle']),str(r['Crop']))
            if key in management:raise ValueError('Duplicate Senegal management key')
            management[key]=(r,self.rid(management_spec,'data_MANAGEMENT',n))
        plot_lookup={};campaign_lookup={};harvest_groups=defaultdict(list)
        for num,crop,organ in [('4','carrot','root'),('5','lettuce','leaf'),('6','tomato','fruit')]:
            spec,tables=by_number[num];name=next(k for k in tables if k.endswith('_harvest'))
            for n,r in tables[name]:
                rid=self.rid(spec,next(k for k in self._sheet_names(spec) if k.strip()==name),n)
                year,cycle,plot,treatment=int(r['Year']),str(r['Cycle']),str(r['Plot']),str(r['Treatment'])
                if treatment not in ['D100','D200','PL100','PL200','SS100','SS200','SF100']:
                    self.issue('UNRECOGNIZED_TREATMENT',rid,'Source retained, not silently aliased.',severity='error');continue
                suffix=plot.rsplit('_',1)[-1]
                pid,tr=self.plot(trial,plot,treatment,suffix,64,control=treatment=='SF100',control_definition='Synthetic fertilizer reference covering reported P needs; not zero nutrient',assignment={'label':treatment,'basis':'100 or 200 percent of P requirement; product-specific N/K co-inputs'},randomized_blocks=False)
                plot_lookup[plot]=(pid,tr)
                key=(year,cycle,crop.title());mr=management.get(key)
                if not mr:self.issue('MANAGEMENT_MISSING',rid,'Crop dates and product application dates remain unknown.')
                cid=stable(pid,year,cycle+':'+crop)
                if (plot,year,cycle,crop) not in campaign_lookup:
                    self.campaign(pid,year,cycle+':'+crop,crop,{'tomato':'Mongal','lettuce':'Eden','carrot':'Pamela +'}[crop],source,rid,valid_date(mr[0]['Date_sowing']) if mr else None,valid_date(mr[0]['Harvest_date']) if mr else None,'documented day' if mr else 'year and cycle only')
                    campaign_lookup[(plot,year,cycle,crop)]=cid
                harvest_groups[(cid,crop)].append((rid,r))
        for (cid,crop),rows in harvest_groups.items():
            first=rows[0][1];values=[];keys=[]
            for rid,r in rows:
                key=str(r.get('Harvest_nb') if crop=='tomato' else r.get('Cropping_bed'))
                keys.append(key)
                if crop=='tomato':
                    weights=[number(r.get(x)) for x in ['Cat1_tot_weight','Cat2_weight','Cat3_weight','Cat4_weight','Cat5_weight']]
                    value=sum(weights) if all(v is not None for v in weights) else None
                else:value=number(r.get('Tot_weight_'+('carrots' if crop=='carrot' else 'lettuce')))
                if value is not None and value<0:self.issue('IMPOSSIBLE_HARVEST_MASS',rid,'Negative mass excluded.',severity='error');value=None
                values.append(value)
            expected={f'H{i}' for i in range(1,6)} if crop=='tomato' else {str(i) for i in range(1,7)}
            full=set(keys)==expected and len(keys)==len(expected) and all(v is not None for v in values)
            mass=sum(values) if full else None
            status='reported_complete' if full else 'incomplete_no_extrapolation'
            reconstructed=crop=='carrot' and first['Cycle']=='C2' or crop=='lettuce' and first['Cycle'] in ['C2','C3']
            if reconstructed:
                self.issue('RECONSTRUCTED_BED_SUBSAMPLES',cid,'Source split plot totals across six beds. Only one plot × campaign is retained; beds are never six experimental replicates.')
                if full:status='reported_plot_total_from_reconstructed_beds'
            self.put('harvests',id=stable(cid,'full-harvest'),campaign_id=cid,event_label='full-harvest',harvested_on=valid_date(management.get((int(first['Year']),str(first['Cycle']),crop.title()),({},None))[0].get('Harvest_date')),organ={'carrot':'root','lettuce':'leaf','tomato':'fruit'}[crop],product_basis='fresh product, all source categories',moisture_percent=None,area_m2=48,denominator='documented_cropped_beds_48_m2_not_gross_64_m2',yield_value=None,yield_unit=None,yield_kg_ha=mass*10000/48 if mass is not None else None,mass_kg=mass,status=status,source_row_id=rows[0][0])
            if not full:self.issue('HARVEST_COVERAGE_INCOMPLETE',cid,'Missing bed or harvest/category value: no seasonal total extrapolated.')
        soil_spec,st=by_number['1'];methods=self.readme(soil_spec);soil_candidates=defaultdict(list)
        for n,r in st['data_SOIL']:
            rid=self.rid(soil_spec,'data_SOIL',n);parts=str(r.get('Depth_soil')).split('_')
            if len(parts)!=2 or any(number(v) is None for v in parts):self.issue('SOIL_DEPTH_UNRESOLVED',rid,'No depth imputed.',severity='error');continue
            top,bottom=map(float,parts)
            if not 0<=top<bottom:self.issue('SOIL_DEPTH_INVALID',rid,'No profile normalized.',severity='error');continue
            plot=str(r['Plot']);pid,tr=plot_lookup.get(plot,(None,None));profile=stable(rid,'soil');sampled=valid_date(r.get('Date_sampling'))
            self.put('soil_profiles',id=profile,site_id=site,plot_id=pid,treatment_id=tr,year=int(r['Year']),sampled_on=sampled,sampling_phase='source reports end of crop rotation; not a pre-season measurement by default',upper_cm=top,lower_cm=bottom,sampling_support='bare-soil bed' if plot.startswith('BS_') else 'experimental plot soil layer',source_row_id=rid,licence=soil_spec['license'])
            if pid and sampled:soil_candidates[pid].append((sampled,profile,top,bottom))
            for field,v in r.items():
                if field in ['Year','Cycle','Treatment','Plot','Depth_soil','Date_sampling','Ref_SN'] or field.startswith('_column_'):continue
                meta=methods.get(field,{})
                self.measurement(profile,field,v,str(meta.get('unit') or 'not established in this cell; see source README merged metadata'),str(meta.get('method') or 'not established in this cell; see source README merged metadata'),field,soil_spec['published_at'])
        for cid in campaign_lookup.values():
            c=self.db.execute('SELECT * FROM campaigns WHERE id=?',(cid,)).fetchone()
            # Strictly past samples only. End-of-rotation values are not fed into their own crop.
            past=[x for x in soil_candidates[c['plot_id']] if c['sowing_date'] and x[0]<c['sowing_date']]
            by_depth={}
            for item in sorted(past):by_depth[item[2:]]=item
            for sampled,profile,_,_ in by_depth.values():
                self.put('campaign_soil_links',campaign_id=cid,profile_id=profile,temporal_basis='latest strictly earlier sample at each documented depth',predictor_eligible=0,reason='Sample predates crop; analytical result availability before issue date still not documented. No post-harvest join.')
        fert_spec,ft=by_number['2'];chem_methods=self.readme(fert_spec);analyses=[]
        for n,r in ft['data_CHEM_PROPERTIES']:
            rid=self.rid(fert_spec,'data_CHEM_PROPERTIES',n);aid=stable(rid,'analysis')
            comp={k:{'value':number(v),'original':v,'unit':chem_methods.get(k,{}).get('unit')} for k,v in r.items() if k not in ['Year','Cycle','Crop','Fertilizer_type','Date_sampling','Ref_SN']}
            self.put('product_analyses',id=aid,trial_id=trial,year=int(r['Year']),crop=str(r['Crop']),product=str(r['Fertilizer_type']),sampled_on=valid_date(r.get('Date_sampling')),composition_json=dumps(comp),method_json=dumps(chem_methods),source_row_id=rid)
            analyses.append((r,aid))
        amounts={}
        for n,r in ft['data_AMOUNT']:
            key=(int(r['Year']),str(r['Cycle']),str(r['Crop']),str(r['Treatment']))
            if key in amounts:raise ValueError('Duplicate Senegal fertilizer amount key')
            amounts[key]=(r,self.rid(fert_spec,'data_AMOUNT',n))
        for (plot,year,cycle,crop),cid in campaign_lookup.items():
            pid,tr=plot_lookup[plot];treatment=self.db.execute('SELECT source_label FROM treatments WHERE id=?',(tr,)).fetchone()[0]
            amount=amounts.get((year,cycle,crop.title(),treatment));mr=management.get((year,cycle,crop.title()))
            if not amount:self.issue('FERTILIZER_DOSE_MISSING',cid,'No fertilizer amount row matched; never replaced by zero.');continue
            r,rid=amount;md=mr[0] if mr else {}
            for field,product,date_field,multiplier in [('Amount_applied_OWP',str(r['Fertilizer_type']),'OWP_application_date',1000),('Amount_applied_chem_10_10_20','SF_NPK_10_10_20','SF_application_date',1),('Amount_applied_chem_urea','SF_Urea','Date_chemical_complementation',1),('Amount_applied_chem_K2SO4','SF_K_Sulfate','Date_chemical_complementation',1)]:
                value=number(r.get(field));applied=valid_date(md.get(date_field))
                if value is not None and value<0:self.issue('FERTILIZER_DOSE_INVALID',rid,'Negative dose kept only in source row.',field,'error');value=None
                # Exact cycle/crop/batch only; never extend one year's composition to missing years.
                normalized=lambda s:str(s).lower().replace('_','').replace(' ','')
                matching=[(a,aid) for a,aid in analyses if int(a['Year'])==year and str(a['Cycle'])==cycle and a['Crop'] in [crop.title(),'All'] and normalized(a['Fertilizer_type'])==normalized(product) and (not applied or valid_date(a.get('Date_sampling')) and valid_date(a['Date_sampling'])<=applied)]
                comp_id=matching[0][1] if len(matching)==1 else None
                self.put('interventions',id=stable(cid,field),plot_id=pid,campaign_id=cid,year=year,season=cycle,date=applied,date_precision='documented day' if applied else 'unknown day; cycle only',kind='organic_fertilizer' if field=='Amount_applied_OWP' else 'mineral_fertilizer',product=product,dose=value*multiplier if value is not None else None,unit='kg fresh commercial matter/ha of cropped beds',dose_basis='reported_applied_product_not_elemental_NPK',composition_id=comp_id,application_method=None,application_depth_cm=None,status='reported_applied' if value is not None else 'unknown',source_row_id=rid)
        # Preserve biological/dry-weight subsamples, including missing and original categorical values.
        for num in ['4','5','6']:
            spec,tables=by_number[num];crop={'4':'carrot','5':'lettuce','6':'tomato'}[num];meta=self.readme(spec)
            for name,records in tables.items():
                if name.endswith('_harvest'):continue
                original_name=next(k for k in self._sheet_names(spec) if k.strip()==name)
                for n,r in records:
                    plot=str(r.get('Plot',''));alias=plot.replace('-','_')
                    if plot not in plot_lookup and alias in plot_lookup:
                        self.issue('SOURCE_PLOT_ALIAS',self.rid(spec,original_name,n),f'Explicit source label {plot} matched to documented plot {alias}; original retained.');plot=alias
                    key=(plot,int(r['Year']),str(r['Cycle']),crop);cid=campaign_lookup.get(key)
                    if not cid:self.issue('PLANT_JOIN_UNRESOLVED',self.rid(spec,original_name,n),'No unique plot × crop × cycle; observation remains in staging.');continue
                    for field,value in r.items():
                        if field in ['Year','Cycle','Treatment','Plot','Sample_nb','Plant_nb','Harvest_nb','Observation_date'] or field.startswith('_column_'):continue
                        d=meta.get(field,{})
                        self.put('plant_observations',id=stable(cid,name,n,field),campaign_id=cid,observed_on=valid_date(r.get('Observation_date')),parameter=field,value=number(value),original_value=None if value is None else str(value),unit=str(d.get('unit') or 'source README, unqualified'),method=str(d.get('method') or 'source README, unqualified'),sampling_unit=str(r.get('Sample_nb',r.get('Plant_nb',r.get('Harvest_nb','plot subsample')))),source_row_id=self.rid(spec,original_name,n))
        self.issue('NO_UNFERTILIZED_CONTROL',trial,'SF100 is a mineral reference; no unfertilized crop control. Bare-soil beds have no comparable harvested crop.')
        self.issue('WATER_HISTORY_NOT_ACQUIRED',trial,'No plot irrigation volume or complete daily meteorological forcing acquired in these six workbooks; no calibrated water-response model.')
        self.issue('SITE_SPECIFIC_RESEARCH_LICENCE',trial,'One site; three vegetable crops, not maize or all Senegal; NC-SA data excluded from the operational yield engine.')

    def _sheet_names(self,spec):
        return [r[0] for r in self.db.execute('SELECT name FROM sheets WHERE file_id=?',(self.file_ids[spec['path']],))]

    def build(self):
        sen=[]
        for spec in self.manifest['files']:
            path=self.read_file(spec)
            if path is None:continue
            if path.suffix=='.xlsx':
                tables=self.stage_workbook(spec,path)
                if spec['source_id']=='cirad-gagnoa':self.import_gagnoa(spec,tables)
                elif spec['source_id']=='cirad-soere-senegal':sen.append((spec,tables))
            else:
                records=self.stage_csv(spec,path)
                {'wosis-phaq':self.import_wosis,'ofra-functions':self.import_ofra,'iita-togo-variety':self.import_variety_context}[spec['source_id']](spec,records)
        if sen:
            if len(sen)!=6:raise ValueError('Senegal import needs all six version-matched workbooks')
            self.import_senegal(sen)
        self.check()
        self.db.commit()
        report=self.report()
        (self.out/'quality.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        self.export_tables()
        self.db.close()
        if (self.out/'experimental.sqlite').exists():raise ValueError('Refuse to overwrite an existing database')
        self.path.rename(self.out/'experimental.sqlite')
        return report

    def check(self):
        if self.db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('Broken foreign key')
        for row in self.db.execute('SELECT id,latitude,longitude,country FROM sites'):
            bounds={'TGO':(-.3,2.0,5.9,11.5),'BEN':(.7,4.0,6,12.6),'BFA':(-5.7,2.7,9.2,15.3),'GHA':(-3.5,1.4,4.4,11.4),'CIV':(-8.8,-2.3,4,11),'SEN':(-17.8,-11,12,17)}.get(row['country'])
            if bounds and row['longitude'] is not None and not(bounds[0]<=row['longitude']<=bounds[1] and bounds[2]<=row['latitude']<=bounds[3]):self.issue('COUNTRY_COORDINATE_REVIEW',row['id'],'Outside coarse country bounds; not snapped, swapped or assigned to another country.')
        for r in self.db.execute('SELECT id,sowing_date,harvest_date FROM campaigns'):
            if r['sowing_date'] and r['harvest_date'] and r['sowing_date']>r['harvest_date']:self.issue('CROP_DATE_ORDER',r['id'],'Sowing later than harvest; campaign requires review.',severity='error')
        # Dependencies are sites: no spatially independent split is possible within a one-site pilot.
        overlaps=self.db.execute('SELECT c.dependency_group FROM split_assignments a JOIN campaigns c ON c.id=a.campaign_id GROUP BY c.dependency_group HAVING COUNT(DISTINCT a.split)>1').fetchall()
        if overlaps:raise ValueError('Site/dependency leakage between splits')
        if self.db.execute('SELECT 1 FROM campaigns c JOIN split_assignments a ON a.campaign_id=c.id WHERE c.synthetic=1').fetchone():raise ValueError('Synthetic data entered an agronomic validation split')

    def report(self):
        counts={r[0]:self.db.execute('SELECT count(*) FROM "'+r[0]+'"').fetchone()[0] for r in self.db.execute('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name')}
        crops=[dict(r) for r in self.db.execute('SELECT s.country,v.crop,count(*) AS plot_seasons,count(DISTINCT p.id) AS plots,count(DISTINCT t.site_id) AS sites,min(c.year) AS first_year,max(c.year) AS last_year,sum(CASE WHEN h.yield_kg_ha IS NOT NULL THEN 1 ELSE 0 END) AS quantified_harvests FROM campaigns c JOIN plots p ON p.id=c.plot_id JOIN trials t ON t.id=p.trial_id JOIN sites s ON s.id=t.site_id JOIN crop_varieties v ON v.id=c.variety_id LEFT JOIN harvests h ON h.campaign_id=c.id GROUP BY s.country,v.crop ORDER BY s.country,v.crop')]
        issues=[dict(r) for r in self.db.execute('SELECT code,severity,count(*) AS count FROM qc_issues GROUP BY code,severity ORDER BY code')]
        return {'version':VERSION,'input_fingerprints':{'manifest_sha256':hashlib.sha256((DATA/'manifest.json').read_bytes()).hexdigest(),'registry_sha256':hashlib.sha256((ROOT/'docs/calibration/REGISTRE_SOURCES.json').read_bytes()).hexdigest(),'schema_sha256':hashlib.sha256((DATA/'schema.sql').read_bytes()).hexdigest(),'importer_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'xlsx_reader_sha256':hashlib.sha256((Path(__file__).parent/'xlsx_reader.py').read_bytes()).hexdigest()},'purpose':'noncommercial_research' if self.research else 'open_context_only','files':[{'path':s['path'],'sha256':s['sha256'],'license':s['license']} for s in self.loaded_files],'table_counts':counts,'plot_seasons':crops,'missingness':{'soil_values_missing':self.db.execute('SELECT count(*) FROM soil_measurements WHERE value IS NULL').fetchone()[0],'plant_values_missing':self.db.execute('SELECT count(*) FROM plant_observations WHERE value IS NULL').fetchone()[0],'harvest_values_unavailable':self.db.execute('SELECT count(*) FROM harvests WHERE yield_kg_ha IS NULL').fetchone()[0]},'pilot_cohort':dict(self.db.execute("SELECT count(*) AS plot_seasons,min(c.year) AS first_year,max(c.year) AS last_year,count(DISTINCT c.plot_id) AS plots FROM campaigns c JOIN crop_varieties v ON v.id=c.variety_id JOIN plots p ON p.id=c.plot_id JOIN trials t ON t.id=p.trial_id WHERE t.source_id='cirad-gagnoa' AND c.season='First' AND v.crop='maize' AND v.variety='H507'").fetchone()),'issues':issues,'calibrated_countries':[],'validation_split_assigned':False,'source_harvest_values_are_not_validated_model_predictions':True}

    def export_tables(self):
        target=self.out/'tables';target.mkdir(exist_ok=True)
        for (table,) in self.db.execute('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name'):
            rows=self.db.execute('SELECT * FROM "'+table+'"')
            with (target/(table+'.csv')).open('w',newline='') as f:
                w=csv.writer(f);w.writerow([d[0] for d in rows.description]);w.writerows(rows)
        (self.out/'LICENCE.txt').write_text('RESEARCH NON COMMERCIAL ONLY: contains CC BY-NC-SA 4.0 CIRAD data and derivatives. Source-specific attribution and other licences remain applicable. No trained model delivered.\n' if self.research else 'Open context snapshots only. Per-source and per-record licences in sources/source_files/soil_profiles remain applicable. No training plot dataset or calibrated model implied.\n')


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',required=True)
    p.add_argument('--include-noncommercial-research',action='store_true',help='Accept research-only use of NC-SA source data and derived database; never loads them into production D1.')
    args=p.parse_args()
    builder=Builder(args.output,args.include_noncommercial_research)
    try:report=builder.build()
    except Exception:
        builder.db.close()
        builder.path.unlink(missing_ok=True)
        raise
    print(json.dumps({'version':report['version'],'purpose':report['purpose'],'table_counts':report['table_counts'],'plot_seasons':report['plot_seasons'],'calibrated_countries':[]},ensure_ascii=False))

if __name__=='__main__':
    main()
