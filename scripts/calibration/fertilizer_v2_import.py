"""Reproduce source-separated v2 contrasts without imputing missing values.

Run --prepare before any model evaluation. Originals and earlier protocols are
immutable. Primary AMAZXA supplements supersede, never augment, Carob records.
Only the Python standard library and the repository XLSX reader are required.
"""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import io
import json
from pathlib import Path
import zipfile

from fertilizer_pipeline import digest, num, write
from xlsx_reader import Workbook

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'research-data/fertilizer/v2'
DOC = ROOT / 'docs/calibration/fertilizer/v2'
KEYS = ('country', 'location', 'trialId', 'year', 'season', 'system', 'variety')
QUARANTINE = {
    '4CFDEG': 'dose_T5_moisture_coordinates_and_overlap_unresolved',
    'TROYBD': 'original_pair_identity_rates_and_country_unresolved',
    'BBKJH0': 'missing_household_identity_oxide_units_and_management_confounding',
    'SRANPI': 'variety_zinc_gypsum_and_fertilization_change_together',
}


def verify_sources(base=BASE):
    receipts = json.loads((base / 'sources.json').read_text())
    supplements = json.loads((base / 'supplement-sources.json').read_text())
    verified = []
    archives = {}
    for s in receipts:
        path = base / 'raw' / (s['id'] + '.zip')
        b = path.read_bytes()
        if hashlib.sha256(b).hexdigest() != s['sha256'] or len(b) != s['bytes']:
            raise ValueError('Original checksum mismatch: ' + path.name)
        with zipfile.ZipFile(io.BytesIO(b)) as z:
            if z.testzip() is not None:
                raise ValueError('Corrupt archive: ' + path.name)
            prefix = 'doi_10.7910_DVN_' + s['id']
            meta = list(csv.DictReader(io.StringIO(z.read(prefix + '_meta.csv').decode('utf-8-sig'))))[0]
            if meta['license'] != s['license']:
                raise ValueError('License mismatch: ' + s['id'])
            rr = list(csv.DictReader(io.StringIO(z.read(prefix + '.csv').decode('utf-8-sig'))))
        if len(rr) != s['rows'] or len({r['record_id'] for r in rr}) != len(rr):
            raise ValueError('Changed record count or duplicate identity: ' + s['id'])
        archives[s['id']] = rr
        verified.append(dict(path=path.name, sha256=s['sha256'], rows=len(rr), license=meta['license']))
    for s in supplements:
        b = (base / 'raw' / s['path']).read_bytes()
        if hashlib.sha256(b).hexdigest() != s['sha256'] or len(b) != s['bytes']:
            raise ValueError('Original checksum mismatch: ' + s['path'])
        verified.append(dict(path=s['path'], sha256=s['sha256'], license=s['license']))
    return archives, verified


def primary_p_rows(base=BASE):
    """Join explicit environment IDs, not the erroneous yield-sheet trial header.

    Table_1 and the article Table 1 agree on trial numbers; Data_Sheet_1 collapses
    environments 16..21 under trial 9 and shifts subsequent numbers. The country
    in the yield sheet avoids the design sheet's literal 'Benin Bohicon'.
    """
    w = Workbook(base / 'raw/AMAZXA-design.xlsx')
    env = {int(r[0]): (i, r + [None] * max(0, 19-len(r)))
           for i, r in w.rows('Per environment') if i >= 3 and isinstance(r[0], (int, float))}
    w.close()
    w = Workbook(base / 'raw/AMAZXA-yields.xlsx')
    sheet = dict(w.rows('Grain yield'))
    if sheet[11][1] != 'Grain yield (g m-2)' or set(env) != set(range(1, 42)):
        raise ValueError('Unexpected primary yield units/environment IDs')
    out = []
    for i in sorted(sheet):
        if i < 12:
            continue
        cells = sheet[i]
        if not cells or not isinstance(cells[0], str) or not cells[0].strip():
            break
        # Genotypes end before a blank row, then the workbook's summary statistics.
        if i > 12 and i-1 not in sheet:
            break
        for j, eid in enumerate(sheet[3][1:], 1):
            y = num(cells[j]) if j < len(cells) else None
            if y is None:
                continue
            di, d = env[int(eid)]
            country = str(sheet[5][j]).strip().replace('The Gambia', 'Gambia')
            site = str(sheet[6][j]).strip()
            if site.casefold() != str(d[3]).strip().casefold() or int(sheet[7][j]) != int(d[6]):
                raise ValueError('Environment context mismatch')
            out.append(dict(source='AMAZXA', recordId=f'Grain yield!R{i}C{j+1}',
                designRecord=f'Per environment!R{di}', environmentId=int(eid),
                country=country, location=site, trialId=str(int(d[1])), year=int(d[6]),
                yieldHeaderTrialId=str(int(sheet[4][j])), season=str(d[7]).lower() if d[7] else None,
                system=str(d[4]).lower(), variety=cells[0].strip(),
                treatment=sheet[9][j].strip(), nutrients=[num(d[k]) for k in (11,12,13)],
                yieldKgHa=y*10, moisturePercent=14, replicationCount=num(d[17]), blockId=None,
                irrigated=country not in ('Burkina Faso','Gambia'),
                assignment='neighboring_P_environments_not_qualified_randomization',
                license='CC-BY-4.0'))
    w.close()
    return out


def reject(rows, reason, rejected):
    rejected.extend(dict(source=r['source'], recordId=r['recordId'], reason=reason) for r in rows)


def make_pair(c, t, family):
    return dict(id=digest([c['source'], c['recordId'], t['recordId']])[:24], family=family,
        source=c['source'], publication='10.3389/fpls.2016.01435' if family=='P_environment' else '10.1371/journal.pone.0317170',
        country=c['country'], site=c['country']+'/'+c['location'], location=c['location'],
        trialId=c['trialId'], year=c['year'], season=c['season'], system=c['system'],
        campaign='|'.join(str(c[k]) for k in ('country','location','trialId','year','season')),
        variety=c['variety'], controlRecord=c['recordId'], treatmentRecord=t['recordId'],
        baselineNutrients=c['nutrients'], treatedNutrients=t['nutrients'],
        controlKgHa=c['yieldKgHa'], treatedKgHa=t['yieldKgHa'], deltaKgHa=t['yieldKgHa']-c['yieldKgHa'],
        moisturePercent=c['moisturePercent'], irrigated=c['irrigated'],
        unit='kg grain/ha at 14% moisture' if c['moisturePercent']==14 else 'kg grain/ha as reported; moisture unqualified',
        nutrientBasis='elemental_N_P_K_kg_ha', assignment=c['assignment'],
        replicateLevel=False, independentStudyCount=1, license=c['license'])


def pair_p(rows, rejected):
    groups=defaultdict(list)
    for r in rows:
        groups[tuple(r[k] for k in KEYS)].append(r)
    pairs=[]
    for _, rr in sorted(groups.items(), key=lambda x:str(x[0])):
        if any(r[k] is None or r[k]=='' for r in rr for k in KEYS):
            reject(rr,'missing_identity_or_season_no_fill',rejected);continue
        if sorted(r['treatment'] for r in rr)!=['+P','-P']:
            reject(rr,'no_unique_P_pair_by_trial_season_variety',rejected);continue
        c=next(r for r in rr if r['treatment']=='-P');t=next(r for r in rr if r['treatment']=='+P')
        if any(v is None for r in rr for v in r['nutrients']):
            reject(rr,'unknown_background_nutrients_no_zero_fill',rejected);continue
        if any(r['yieldKgHa']<0 for r in rr):
            reject(rr,'negative_adjusted_level_not_physical_yield',rejected);continue
        if c['nutrients'][::2]!=t['nutrients'][::2] or c['nutrients'][1]!=0 or t['nutrients'][1]<=0:
            reject(rr,'background_N_K_or_P_contrast_incompatible',rejected);continue
        p=make_pair(c,t,'P_environment');p['environmentIds']=[c['environmentId'],t['environmentId']]
        p['replicationCounts']=[c['replicationCount'],t['replicationCount']]
        pairs.append(p)
    return pairs


def rice_regime_rows(rr):
    out=[]
    for r in rr:
        out.append(dict(source='GFWCYQ',recordId=r['record_id'],country=r['country'],location=r['location'],
            crop=r['crop'],trialId=r['trial_id'],year=int(r['planting_date'][:4]),season=r['season'] or None,
            system='lowland',variety=r['variety'],treatment=r['treatment'],
            nutrients=[num(r[n+'_fertilizer']) for n in ('N','P','K')],yieldKgHa=num(r['yield']),
            moisturePercent=None,irrigated=r['irrigated']=='TRUE',blockId=None,
            assignment='randomized_long_term_regime_same_plots_repeated',license='CC0-1.0'))
    return out


def pair_regimes(rows, rejected):
    groups=defaultdict(list)
    for r in rows:
        if r['crop']!='rice' or r['country']!='Senegal' or r['location']!='Ndiaye':
            reject([r],'outside_Ndiaye_rice_protocol',rejected);continue
        groups[tuple(r[k] for k in KEYS)].append(r)
    out=[]
    for _, rr in sorted(groups.items()):
        doses=sorted(tuple(r['nutrients']) for r in rr if all(v is not None for v in r['nutrients']))
        if doses!=[(0,0,0),(60,26,50),(120,26,50),(180,26,50)] or len(rr)!=4:
            reject(rr,'incomplete_or_ambiguous_regime_campaign',rejected);continue
        if any(r['yieldKgHa'] is None or r['yieldKgHa']<0 for r in rr):
            reject(rr,'missing_or_invalid_observed_yield',rejected);continue
        c=next(r for r in rr if r['nutrients']==[0,0,0])
        out.extend(make_pair(c,t,'long_term_NPK_regime') for t in rr if t!=c)
    return out


def prepare(base=BASE):
    archives, verified=verify_sources(base)
    rows=primary_p_rows(base)+rice_regime_rows(archives['GFWCYQ'])
    rejected=[]
    pairs=pair_p([r for r in rows if r['source']=='AMAZXA'],rejected)
    pairs+=pair_regimes([r for r in rows if r['source']=='GFWCYQ'],rejected)
    for sid in ('AMAZXA',*QUARANTINE):
        reason='superseded_by_primary_supplements_do_not_pool' if sid=='AMAZXA' else QUARANTINE[sid]
        rejected.extend(dict(source=sid,recordId=r['record_id'],reason=reason) for r in archives[sid])
    pairs.sort(key=lambda r:r['id']);rows.sort(key=lambda r:(r['source'],r['recordId']))
    if len({p['id'] for p in pairs})!=len(pairs):raise ValueError('Duplicate contrast identity')
    audit=dict(sources=verified,quarantine=QUARANTINE,
        primaryRows=dict(Counter(r['source'] for r in rows)),
        primaryTrialHeaderDisagreements=sum(r.get('yieldHeaderTrialId',r['trialId'])!=r['trialId'] for r in rows),
        pairCounts=dict(Counter(r['source'] for r in pairs)),
        rejectionCounts=dict(Counter(r['source']+'|'+r['reason'] for r in rejected)),
        independence='AMAZXA: one publication, genotype means within sites; Ndiaye: one site, repeated regimes. Sources kept separate, no overlap with quarantined LTFE.',
        missingValues='Preserved as null in harmonized records. No inferred zeros, dates, blocks or replications.')
    return rows,pairs,rejected,audit


def freeze(base=BASE, doc=DOC):
    rows,pairs,rejected,audit=prepare(base)
    manifest=dict(version='fertilizer-extension-freeze-1',
        protocolSha256=digest(json.loads((doc/'PROTOCOL.json').read_text())),
        amendmentSha256=digest(json.loads((doc/'IMPLEMENTATION.json').read_text())),
        originals=audit['sources'],rowsSha256=digest(rows),pairsSha256=digest(pairs),
        rejectedSha256=digest(rejected),pairIds=[p['id'] for p in pairs],
        bySource={s:dict(pairs=sum(r['source']==s for r in pairs),
            sites=sorted({r['site'] for r in pairs if r['source']==s}),
            campaigns=len({r['campaign'] for r in pairs if r['source']==s})) for s in ('AMAZXA','GFWCYQ')})
    path=base/'FREEZE.json'
    if path.exists() and json.loads(path.read_text())!=manifest:
        raise ValueError('Frozen derived data changed; version and explain before evaluating')
    write(path,manifest);write(base/'harmonized.json',rows);write(base/'pairs.json',pairs)
    write(base/'rejected.json',rejected);write(doc/'IMPORT_AUDIT.json',audit)
    return manifest


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--prepare',action='store_true',required=True);p.parse_args()
    f=freeze();print(json.dumps(dict(pairsSha256=f['pairsSha256'],bySource=f['bySource'])))
