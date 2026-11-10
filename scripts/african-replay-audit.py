"""Recheck acquired African data. Do not turn missing forcings into a validation."""
from pathlib import Path
from collections import defaultdict,Counter
from statistics import mean
from datetime import datetime
import csv,json,hashlib,sys,gzip,math
root=Path(sys.argv[1]);out=Path('research-data/lirf/2026-11-10')
ghana=root/'calibration_audit/ghana';fields=defaultdict(list)
yield_path=ghana/'Yield_Maize_Biomass_V2.csv'
rows=list(csv.DictReader(yield_path.open()))
for r in rows:fields[r['quadrant_id'].strip().rsplit('Q',1)[0]].append(r)
ground=list(csv.DictReader((ghana/'Ghana_ground_data_v5.csv').open()))
polygons=json.load(open(ghana/'Biophysical_Data_Collection_Polygons_V1.geojson'))['features']
properties=[p['properties'] for p in polygons]
dates=[datetime.strptime(r['date'],'%d/%m/%Y').date().isoformat() for r in ground]
growing_fields=set(r['field_code'].strip() for r in ground)
polygon_fields=set(p['Field_ID'].strip() for p in properties if p.get('Field_ID'))
group_rows=[]
for field,rs in sorted(fields.items()):
    # Deterministic grouping BEFORE any fitting. Never split the same field's quadrats.
    bucket=int(hashlib.sha256(field.encode()).hexdigest()[:8],16)%5
    group_rows.append({'field':field,'quadrats':len(rs),'yieldMeanAsPublished':mean(float(r['yield_quadrant']) for r in rs),'split':'reserved-field' if bucket==0 else 'development-field','groundSeriesAvailable':field in growing_fields,'geometryAvailable':field in polygon_fields})
missing_intrants={key:sum(not p.get(key) for p in properties) for key in ['DATE PLANT','VARIETY','FERT','DATE APPLI','QTY OF FER','SOIL TYPE','IRRIGATION']}
togo=json.load(open(out/'togo-current-rue-summary.json'))
original=[r for r in togo['records'] if r['experiment']=='A-original' and r['calendar']=='daily']
errors=[r['yieldKgHa']-r['observedKgHa'] for r in original]
result={'researchTeamsReplied':False,'noMessagesSent':True,
 'ghana':{'sourceDoi':'10.5281/zenodo.6632083','licence':'CC-BY-4.0','yieldRows':len(rows),'fields':len(fields),'rawQuadratIdDuplicates':len(rows)-len({r['quadrant_id'] for r in rows}),'groupsDifferentFromThree':{k:len(v) for k,v in fields.items() if len(v)!=3},'groundRows':len(ground),'groundDateRange':[min(dates),max(dates)],'polygons':len(polygons),'missingAttributesByPolygon':missing_intrants,'groups':group_rows,'acceptedCompleteEngineYieldPairs':0,'status':'No local dynamic profile calibrated: dated daily water/soil/management and grain moisture are not jointly established. Published yield column retained; no invented unit/moisture conversion. Group split prepared, no claim of fitted accuracy.'},
 'togo':{'kind':'exploratory incomplete-input reconstruction, not independent validation','engine':togo['engines'],'predictionsKgHa':[r['yieldKgHa'] for r in original],'observedKgHa':[r['observedKgHa'] for r in original],'rmseKgHa':math.sqrt(mean(e*e for e in errors)),'ratios':[r['yieldKgHa']/original[0]['yieldKgHa'] for r in original],'plateau':'still explained by illustrative K ceiling; no measured field K inferred','intervalArithmeticCorrection':{'predictionRatio':1.0,'observedReadingInterval':[.813,.851],'inside':.813<=1<=.851}},
 'parakou':{'source':'work_validation/parakou.html and parakou.txt, acquired publication','status':'No original daily forcings/per-treatment files received; not replayable as a complete observed grain benchmark. Published DSSAT model metrics do not measure this engine.'},
 'ina':{'source':'work_validation/ina_supplement.pdf','status':'Supplement reacquired locally; marginal means for years/varieties/fertilizers are not the complete joint trial matrix. No fabricated grain simulation metrics.'},
 'sekou':{'sourceDoi':'10.5281/zenodo.14357601','file':'Maize_growth_data.xlsx','status':'Fresh cob masses cannot be converted to dry grain t/ha without same-basis shelling fraction, grain moisture and harvested area. Excluded from dry-grain metrics; raw missingness retained.'},
 'itra_fsrp':{'status':'No received plot-level field sheets; no local accuracy metrics.'},
 'evaluationRules':['A fit optimum at a bound is investigated, not universally rejected.','Digitization reading error is not a prediction interval or biological variability.','Fields/years are the independent grouping level; quadrats and treatment means do not create independent climates.']}
(out/'african-data-audit.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'ghanaFields':len(fields),'togoRmseKgHa':result['togo']['rmseKgHa'],'ghanaCompleteEnginePairs':0,'sekouDryGrainComparison':'excluded, measurement basis incomplete'}))
