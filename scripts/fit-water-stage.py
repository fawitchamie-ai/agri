from pathlib import Path
import numpy as np,json
from scipy.optimize import lsq_linear
p=Path('research-data/alternative-models/2026-11-11/water')
assert (p/'protocol-before-fit.json').exists()
r=json.load(open(p/'computed-water-features.json'))['records']
train=np.array([x['year']==2012 for x in r]);y=np.array([x['observedKgHa'] for x in r])
def met(pred,obs):
 e=pred-obs;rmse=np.sqrt(np.mean(e*e));return dict(n=len(obs),maeKgHa=float(np.mean(abs(e))),rmseKgHa=float(rmse),biasKgHa=float(np.mean(e)),nrmsePercent=float(100*rmse/np.mean(obs)))
models=[]
models.append(('constant',{},np.full(len(r),y[train].mean())))
srat=np.array([x['season']['eta']/x['season']['etm'] for x in r]);f=np.maximum(0,1-1.25*(1-srat));ym=np.dot(f[train],y[train])/np.dot(f[train],f[train]);models.append(('FAO-seasonal',{'Ym':ym},ym*f))
for water in ['et','tr']:
 ratios=np.array([[z['eta']/z['etm'] if water=='et' else z['tr']/z['trm'] for z in x['phases']] for x in r])
 a=np.column_stack([np.ones(len(r)),np.log(np.maximum(1e-8,ratios))])
 fit=lsq_linear(a[train],np.log(y[train]),bounds=([-np.inf,0,0],[np.inf,np.inf,np.inf]))
 pred=np.exp(a@fit.x);models.append(('Jensen-'+water,{'Ym':float(np.exp(fit.x[0])),'lambdaV':float(fit.x[1]),'lambdaR':float(fit.x[2]),'boundActive':fit.active_mask.tolist()},pred))
out=[]
for name,params,pred in models:
 z={'model':name,'parameters':params,'years':{str(year):met(pred[[x['year']==year for x in r]],y[[x['year']==year for x in r]]) for year in [2012,2013,2011]},'rows':[dict(id=x['id'],year=x['year'],predictedKgHa=float(v),observedKgHa=x['observedKgHa']) for x,v in zip(r,pred)]};out.append(z);print(name,json.dumps({k:z[k] for k in ['parameters','years']}))
(p/'results.json').write_text(json.dumps({'training':[2012],'testUsedForParameterFitting':False,'notBlind':True,'models':out},indent=2)+'\n')
