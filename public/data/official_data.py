"""Harmonisation des observations publiées, sans mélange des dénominateurs.

FAOSTAT rendements nationaux (export fourni) : A principal, X/E diagnostic.
FDW observations de préfectures : frontières non prouvées, aucun score strict.
INSEED P/superficie emblavée : diagnostic explicitement différent du rendement
par superficie récoltée. Aucune observation post2015 n'est écrite dans une
fonction d'apprentissage; le découpage temporel relève du module prévision.
"""
from pathlib import Path
import hashlib,json,re,unicodedata
import numpy as np
import pandas as pd
CROPS={'Maize (corn)':'Maize','Millet':'Millet','Rice':'Rice','Sorghum':'Sorghum'}
FDW_CROPS={'Maize (Corn)':'Maize','Millet':'Millet','Rice (Paddy)':'Rice','Sorghum':'Sorghum'}

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def norm(x):return ''.join(c for c in unicodedata.normalize('NFKD',str(x).strip().lower()) if not unicodedata.combining(c))

def run(raw:Path,out:Path,supplemental:Path|None=None):
    raw=Path(raw);out=Path(out);out.mkdir(parents=True,exist_ok=True)
    fpath=raw/'root/FAOSTAT_data_en_8-31-2026.csv'
    f=pd.read_csv(fpath);f['raw_row']=np.arange(len(f))+2
    f=f[f.Area.eq('Togo')&f.Item.isin(CROPS)&f.Element.eq('Yield')].copy()
    if f.duplicated(['Item','Year']).any():raise ValueError('Duplicated FAOSTAT crop-year')
    if not f.Unit.eq('kg/ha').all():raise ValueError('FAOSTAT expected explicitly kg/ha')
    f['crop']=f.Item.map(CROPS);f['harvest_year']=f.Year.astype(int)
    f['rdt_nat_t_ha']=pd.to_numeric(f.Value,errors='raise')/1000
    if not (np.isfinite(f.rdt_nat_t_ha)&f.rdt_nat_t_ha.gt(0)).all():raise ValueError('Invalid national observations')
    national=f[['crop','harvest_year','rdt_nat_t_ha','Flag','Flag Description','raw_row']].copy()
    national['source_file']=fpath.name;national['source_sha256']=sha(fpath)
    national['source_url']='https://www.fao.org/faostat/en/#data/QCL'
    national['vintage_status']='CURRENT_EXPORT_DATE_IN_FILENAME_2026_08_31_PUBLICATION_DATES_UNKNOWN'
    national['statut_ancre']='OBSERVE_FAOSTAT'
    national.sort_values(['crop','harvest_year']).to_csv(out/'national_history.csv',index=False)
    rows=[]
    for _,r in f[f.Year.between(2016,2026)].iterrows():
        isofficial=r.Flag=='A'
        rows.append(dict(observation_id=f'FAOSTAT_QCL_{r.crop}_{int(r.Year)}',crop=r.crop,forecast_year=int(r.Year),geographic_level='national',territory='Togo',region='Togo',prefecture_modele_35='Togo',observed_t_ha=float(r.rdt_nat_t_ha),source='FAOSTAT_QCL_local_export_2026_08_31',source_url='https://www.fao.org/faostat/en/#data/QCL',source_file=fpath.name,source_sha256=sha(fpath),raw_row_or_page=f'CSV row {int(r.raw_row)}; element Yield; item {r.Item}',original_value=r.Value,original_unit=r.Unit,publication_date='',observation_status=f'{r.Flag}: {r["Flag Description"]}',comparability_status='COMPARABLE_NATIONAL_FAOSTAT_DEFINITION',evaluation_status='RETROSPECTIVE_OFFICIAL_NOT_BLIND' if isofficial else 'DIAGNOSTIC_INSTITUTIONAL_ESTIMATE_OR_EXTERNAL_SOURCE',primary_evaluation=isofficial,area_semantics='FAOSTAT_YIELD_DEFINITION_national',source_family='TOGO_OFFICIAL_POSSIBLY_SHARED_FAOSTAT_FEWS',quality_note='Flag A is an official statistic, not a new independent field measurement. Historical publication dates and revisions unknown.',production_t=np.nan,area_planted_ha=np.nan))
    cpath=raw/'root/crop_data.csv';all_fdw=pd.read_csv(cpath,low_memory=False);all_fdw['raw_row']=np.arange(len(all_fdw))+2
    all_fdw=all_fdw[all_fdw.country.eq('Togo')&all_fdw['product'].isin(FDW_CROPS)].copy()
    d=all_fdw[all_fdw.indicator.eq('Yield')].copy()
    join=['datasourcedocument','fnid','product','season_year','crop_production_system','publication_name','start_date','period_date']
    for indicator,column,unit in [('Quantity Produced','production_t','Tonne'),('Area Planted','area_planted_ha','hectare'),('Area Harvested','area_harvested_ha','hectare')]:
        other=all_fdw[all_fdw.indicator.eq(indicator)][join+['value','unit_name','id']]
        if other.duplicated(join).any():raise ValueError('Duplicate FDW indicator join keys: '+indicator)
        if other.unit_name.ne(unit).any():raise ValueError('Unexpected FDW indicator unit: '+indicator)
        other=other.drop(columns='unit_name').rename(columns={'value':column,'id':column+'_raw_id'})
        d=d.merge(other,on=join,how='left',validate='one_to_one')
    d['year']=pd.to_numeric(d.season_year.str.extract(r'(\d{4})')[0],errors='coerce')
    d=d[d.year.between(2016,2026)]
    geo=json.loads((raw/'exports/geodata/togo_prefectures_modele_35.geojson').read_text())
    names={norm(x['properties']['admin_2']):x['properties']['admin_2'] for x in geo['features']}
    unitids={x['properties']['fnid'] for x in geo['features']}
    for _,r in d.iterrows():
        pref=pd.notna(r.admin_2);level='prefectural' if pref else 'regional'
        value=pd.to_numeric(r.value,errors='coerce')
        valid=np.isfinite(value) and value>0 and r.unit_name=='tonnes per hectare'
        # Even a matching name is not a boundary equivalence certificate.
        comp='EXCLUDED_GEOGRAPHY_UNVERIFIED' if pref else 'EXCLUDED_NO_MATCHED_REGIONAL_MODEL_AND_AREA_SEMANTICS'
        if not valid:comp='EXCLUDED_MISSING_OR_INVALID_OBSERVATION'
        if pref and r.fnid in unitids:
            # Such rows were absent in the inspected snapshot. Stop on changed input
            # instead of silently granting an unreviewed spatial equivalence.
            comp='REQUIRES_REVIEW_MATCHING_UNIT_ID'
        rows.append(dict(observation_id=f'FDW_{int(r.id)}',crop=FDW_CROPS[r['product']],forecast_year=int(r.year),geographic_level=level,territory=str(r.admin_2 if pref else r.admin_1),region=r.admin_1,prefecture_modele_35=names.get(norm(r.admin_2),'') if pref else '',observed_t_ha=float(value) if np.isfinite(value) else np.nan,source='FEWS_FDW_INSEED_official_statistics',source_url='https://fdw.fews.net/',source_file=cpath.name,source_sha256=sha(cpath),raw_row_or_page=f'CSV row {int(r.raw_row)}; id={int(r.id)}; {r.publication_name}',original_value=r.value,original_unit=r.unit_name,publication_date='',observation_status=f'{r.status}; {r.collection_status}; {r.document_type}',comparability_status=comp,evaluation_status='EXCLUDED_FROM_SCORES',primary_evaluation=False,area_semantics='planted_available_harvested_not_available',source_family='FEWS_HARVESTSTAT_INSEED_related',quality_note='Collection_date is not publication_date. Post2015 prefectural FNID geometry equivalence not established.',fnid=r.fnid,collection_date=r.collection_date,production_t=r.production_t,area_planted_ha=r.area_planted_ha,area_harvested_ha=r.area_harvested_ha,production_raw_id=r.production_t_raw_id,area_planted_raw_id=r.area_planted_ha_raw_id,area_harvested_raw_id=r.area_harvested_ha_raw_id))
    observations=pd.DataFrame(rows)
    if supplemental is not None:
        extra=pd.read_csv(supplemental)
        if not set(['crop','forecast_year','geographic_level','territory','observed_t_ha','source_sha256']).issubset(extra):raise ValueError('Supplemental schema incomplete')
        extra['observation_id']=[f'INSEED2024_{r.crop}_{r.territory}_{int(r.forecast_year)}' for _,r in extra.iterrows()]
        extra['primary_evaluation']=False
        extra['region']=np.where(extra.geographic_level.eq('national'),'Togo',extra.territory)
        extra['prefecture_modele_35']=np.where(extra.geographic_level.eq('national'),'Togo','')
        observations=pd.concat([observations,extra],ignore_index=True)
    if observations.observation_id.duplicated().any():raise ValueError('Duplicate observation ids')
    pk=observations[observations.primary_evaluation]
    if pk.duplicated(['crop','forecast_year','geographic_level','territory']).any():raise ValueError('More than one primary source per target')
    observations.sort_values(['source','crop','forecast_year','territory']).to_csv(out/'official_observations_with_provenance.csv',index=False)
    audit=observations.groupby(['source','geographic_level','comparability_status','evaluation_status','primary_evaluation'],dropna=False).agg(rows=('observation_id','size'),nonmissing_yields=('observed_t_ha','count'),first_year=('forecast_year','min'),last_year=('forecast_year','max')).reset_index()
    audit.to_csv(out/'source_comparability_audit.csv',index=False)
    coverage=pd.MultiIndex.from_product([list(CROPS.values()),range(2016,2028)],names=['crop','forecast_year']).to_frame(index=False)
    counts=observations.groupby(['crop','forecast_year']).agg(all_nonmissing_records=('observed_t_ha','count'),primary_observations=('primary_evaluation','sum')).reset_index()
    coverage=coverage.merge(counts,on=['crop','forecast_year'],how='left').fillna(0)
    coverage['status']=np.where(coverage.primary_observations.gt(0),'OFFICIAL_NATIONAL_PRIMARY',np.where(coverage.all_nonmissing_records.gt(0),'DIAGNOSTICS_ONLY','NO_COMPARABLE_YIELD_FOUND'))
    coverage.loc[coverage.forecast_year.eq(2027),'status']='FUTURE_FORECAST_NO_OBSERVATION'
    coverage.to_csv(out/'observation_availability.csv',index=False)
    manifest={'faostat_raw_sha256':sha(fpath),'fdw_raw_sha256':sha(cpath),'national_history_rows':len(national),'post2015_records_including_missing':len(observations),'primary_rows':len(pk),'primary_years':sorted(pk.forecast_year.unique().astype(int).tolist()),'missing_published_yields_2025_2026':'searched_not_found_for_comparable_national_crop_yields; 2025 GIEWS total_cereal_production does not provide yield','2027':'no observation; future','official_is_not_independent':'FAOSTAT, INSEED, FEWS and HarvestStat may share original national statistics','vintage2015':'NOT_ESTABLISHED_revised_data_hindcast_only'}
    (out/'official_data_manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False))
    return national,observations,audit
