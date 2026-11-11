"""Field-grouped test of a local canopy nowcast, independent of guessed NPK.

Uses the native reported grain kg/ha (reference moisture unspecified), not a dry
grain conversion. All quadrats of a field stay together. Future LAI is excluded.
"""
from pathlib import Path
import sys,json,hashlib
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.model_selection import LeaveOneGroupOut

src,out=Path(sys.argv[1]),Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
protocol={'version':'ghana-canopy-2026-11-11.1','sourceDoi':'10.5281/zenodo.6632083',
 'hypothesis':'Field mean grain yield = intercept + slope * max(field-mean LAI observed by issue date)',
 'freeParameters':['intercept','slope, nonnegative; ridge alpha=1 fixed before fit'],
 'split':'Sort field IDs by SHA256(ghana-canopy-2026-11-11:ID); first 60% train, next 20% calibration, remaining 20% test',
 'replications':'Quadrats remain together and are retained to describe within-field variability',
 'ambiguity':'7069ZIN has six quadrats and duplicate IDs, excluded from fitting and all accuracy metrics pending resolution',
 'issueDates':['2021-09-20','2021-10-04','2021-10-18','2021-11-05'],
 'selection':'No test-selected dates or parameters; all issue dates reported separately',
 'uncertainty':'Split conformal absolute residual interval, 90% nominal, calibration fields only; coverage evaluated on test fields',
 'grain':'Reported yield_quadrant is kg/ha per article; reference moisture not stated: no conversion or claim of dry matter',
 'validationScope':'Retrospective 2021 single Ghana area; field holdout, no independent later-season evidence',
 'operationalScope':'A nowcast/assimilation from observed LAI, not preseason yield, fertilizer advice or irrigation causal effect',
 'missing':'No known sowing dates, daily management, independent soil NPK or reference grain moisture'}
(out/'protocol-before-fit.json').write_text(json.dumps(protocol,indent=2)+'\n')
y=pd.read_csv(src/'Yield_Maize_Biomass_V2.csv');l=pd.read_csv(src/'Ghana_ground_data_v5.csv')
y['field']=y.quadrant_id.str.replace(r'Q\d+$','',regex=True)
l.date=pd.to_datetime(l.date,dayfirst=True)
l['lai']=l[['lai1','lai2','lai3','lai4']].mean(axis=1)
fy=y.groupby('field').yield_quadrant.agg(['count','mean','std'])
fields=sorted(fy.index[fy['count']==3],key=lambda s:hashlib.sha256(('ghana-canopy-2026-11-11:'+s).encode()).hexdigest())
train=set(fields[:int(.6*len(fields))]);cal=set(fields[int(.6*len(fields)):int(.8*len(fields))]);test=set(fields[int(.8*len(fields)):])
district=l.groupby('field_code').district.first()
def met(pred,obs):
 e=np.array(pred)-np.array(obs);rmse=float(np.sqrt(np.mean(e*e)))
 return {'nFields':len(e),'maeKgHa':float(np.mean(abs(e))),'rmseKgHa':rmse,'biasKgHa':float(np.mean(e)),'nrmsePercent':100*rmse/np.mean(obs)}
results=[]
for date in protocol['issueDates']:
 peak=l.loc[l.date<=date].groupby('field_code').lai.max().rename('peakLai')
 z=fy.join(peak).join(district).loc[fields].dropna(subset=['peakLai'])
 masks={k:z.index.isin(v) for k,v in [('train',train),('calibration',cal),('test',test)]}
 x=z[['peakLai']].to_numpy();obs=z['mean'].to_numpy()
 model=Ridge(alpha=1,positive=True).fit(x[masks['train']],obs[masks['train']])
 pred=np.maximum(0,model.predict(x));constant=np.full(len(z),obs[masks['train']].mean())
 residual=sorted(abs(pred[masks['calibration']]-obs[masks['calibration']]))
 rank=min(len(residual),int(np.ceil((len(residual)+1)*.9)));q=float(residual[rank-1])
 groups=z.district.to_numpy();cross=[]
 for tr,te in LeaveOneGroupOut().split(x,obs,groups):
  m=Ridge(alpha=1,positive=True).fit(x[tr],obs[tr]);pp=np.maximum(0,m.predict(x[te]));cc=np.full(len(te),obs[tr].mean())
  cross.append({'heldOutDistrict':str(groups[te][0]),'canopy':met(pp,obs[te]),'constant':met(cc,obs[te])})
 rows=[{'field':i,'split':next(k for k,m in masks.items() if m[j]),'peakLai':float(x[j,0]),'grainKgHa':float(obs[j]),'predictedKgHa':float(pred[j]),'constantKgHa':float(constant[j]),'quadrats':int(z.loc[i,'count']),'withinFieldSdKgHa':float(z.loc[i,'std']),'district':z.loc[i,'district']} for j,i in enumerate(z.index)]
 result={'issueDate':date,'coefficients':{'interceptKgHa':float(model.intercept_),'slopeKgHaPerLai':float(model.coef_[0])},
  'trainLaiRange':[float(x[masks['train']].min()),float(x[masks['train']].max())],
  'conformal90HalfWidthKgHa':q,'calibrationN':len(residual),
  'test':{'canopy':met(pred[masks['test']],obs[masks['test']]),'constant':met(constant[masks['test']],obs[masks['test']]),
          'coverage90':float(np.mean(abs(pred[masks['test']]-obs[masks['test']])<=q))},
  'leaveDistrictOut':cross,'rows':rows}
 results.append(result);print(date,json.dumps({k:result[k] for k in ['coefficients','test']}),flush=True)
audit={'biophysicalRows':len(l),'yieldQuadratRows':len(y),'yieldFieldIds':len(fy),'unambiguousFields':len(fields),
 'excludedFields':fy.index[fy['count']!=3].tolist(),'unmatchedYieldFields':sorted(set(fy.index)-set(l.field_code)),
 'grainMeanKgHa':float(fy['mean'].mean()),'partition':{'train':sorted(train),'calibration':sorted(cal),'test':sorted(test)},
 'sourceSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in src.glob('*.csv')}}
(out/'results.json').write_text(json.dumps({'protocol':protocol,'audit':audit,'results':results},indent=2,allow_nan=False)+'\n')

# A separately declared, deployable hypothesis uses a relative monitoring window,
# not a fixed 2021 calendar date. Keep the SAME partitions and alpha; this is a
# development extension after inspection of the calendar-date experiment, not a
# new blind test. It requires real green-LAI measurements during vegetation/flowering.
window_protocol={**protocol,'version':'ghana-monitoring-window-2026-11-11.1',
 'hypothesis':'Intercept + slope * maximum field-mean LAI in the first 14 elapsed days of monitoring',
 'issueDates':'Each field first observation date + 14 days, no later observation admitted',
 'testStatus':'Development comparison after calendar-cutoff results; same held-out field labels, not blind',
 'deployment':'Explicit hypothesis only, maize monoculture in the sampled northern Ghana envelope; real LAI observations required'}
(out/'monitoring-protocol-before-fit.json').write_text(json.dumps(window_protocol,indent=2)+'\n')
starts=l.groupby('field_code').date.min();windows=[]
for field in fields:
 start=starts[field];end=start+pd.Timedelta(days=14)
 selected=l.loc[(l.field_code==field)&(l.date>=start)&(l.date<=end)].dropna(subset=['lai'])
 if len(selected)<2:continue
 windows.append({'field':field,'peakLai':float(selected.lai.max()),'monitoringStart':str(start.date()),'issueDate':str(end.date()),'nVisits':len(selected),
                 'grainKgHa':float(fy.loc[field,'mean']),'district':district[field]})
z=pd.DataFrame(windows).set_index('field');x=z[['peakLai']].to_numpy();obs=z.grainKgHa.to_numpy()
masks={k:z.index.isin(v) for k,v in [('train',train),('calibration',cal),('test',test)]}
model=Ridge(alpha=1,positive=True).fit(x[masks['train']],obs[masks['train']]);pred=np.maximum(0,model.predict(x));base=np.full(len(z),obs[masks['train']].mean())
errors=sorted(abs(pred[masks['calibration']]-obs[masks['calibration']]));q=float(errors[min(len(errors),int(np.ceil((len(errors)+1)*.9)))-1])
monitoring={'protocol':window_protocol,'coefficients':{'interceptKgHa':float(model.intercept_),'slopeKgHaPerLai':float(model.coef_[0])},
 'laiRange':[float(x[masks['train']].min()),float(x[masks['train']].max())],'trainN':int(masks['train'].sum()),'calibrationN':len(errors),
 'halfWidth90KgHa':q,'test':{'canopy':met(pred[masks['test']],obs[masks['test']]),'constant':met(base[masks['test']],obs[masks['test']]),
                         'coverage90':float(np.mean(abs(pred[masks['test']]-obs[masks['test']])<=q))},
 'rows':[{**r,'split':next(k for k,v in masks.items() if v[i]),'predictedKgHa':float(pred[i]),'constantKgHa':float(base[i])} for i,r in enumerate(windows)]}
(out/'monitoring-results.json').write_text(json.dumps(monitoring,indent=2,allow_nan=False)+'\n')
profile={'id':'GHA-2021-LAI-monitoring-14d-1','version':'canopy-nowcast-1.0.0','availableOn':'2026-11-11',
 'status':'experimental_local_hypothesis','crop':'maize','country':'GHA',
 'bbox':[-.7089320664,9.2180632403,-.2334742569,9.8124993314],
 'monitoringDays':14,'maxIssueDelayDays':7,'minVisits':2,
 'sourceDoi':'10.5281/zenodo.6632083','article':'10.5194/essd-14-5387-2022',
 'sourceSha256':audit['sourceSha256'],'grainMoisturePercent':None,'grainBasis':'grain, moisture basis unspecified in supplied table',
 'coefficients':monitoring['coefficients'],'laiRange':monitoring['laiRange'],
 'trainFields':monitoring['trainN'],'calibrationFields':monitoring['calibrationN'],'test':monitoring['test'],
 'interval':{'nominalCoverage':.9,'halfWidthKgHa':q,'method':'split conformal absolute residuals, calibration fields only; small local sample, no later-season coverage established'},
 'validationScope':'2021 sampled maize fields near Tamale, field holdout after development; no later-season or cross-country validation',
 'limits':['Requires field-measured green LAI; NDVI alone is not LAI.',
           'Initial monitoring in vegetation/flowering; no sowing-date reconstruction from field polygons.',
           'Cannot identify causal irrigation, fertilizer, heat or pest effects.',
           'No reference-moisture conversion; output retains the native reported grain basis.',
           'Not a preseason forecast; uncertainty is large and locally evaluated only.']}
profile_dir=Path('lib/seasonal/profiles');profile_dir.mkdir(parents=True,exist_ok=True)
(profile_dir/'ghana-canopy-2021.json').write_text(json.dumps(profile,indent=2,allow_nan=False)+'\n')
print('MONITORING14',json.dumps({k:monitoring[k] for k in ['coefficients','laiRange','test']}))
