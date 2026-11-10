"""Pinned AquaCrop-OSPy comparator, never used as a measured yield or deployed substitute."""
import os
os.environ['DEVELOPMENT']='DEVELOPMENT'
import copy,gzip,json,pathlib,importlib.metadata,hashlib
import numpy as np
import pandas as pd
from aquacrop import AquaCropModel,Crop,Soil,InitialWaterContent,IrrigationManagement
folder=pathlib.Path('research-data/togo-causal/2026-11-10')
if importlib.metadata.version('aquacrop')!='3.0.12':raise RuntimeError('Use aquacrop==3.0.12')
source=json.load(gzip.open('research-data/simulation-audit/2026-11-10/after.json.gz'))
rue=json.load(gzip.open(folder/'rue-daily.json.gz'))
c=source['cases'][0]['config']
weather=pd.DataFrame([{'MinTemp':r['temperatureMinC'],'MaxTemp':r['temperatureMaxC'],'Precipitation':r['rainMm'],'ReferenceET':r['et0Mm'],'Date':pd.Timestamp(r['date'])} for r in c['weather']])
overrides=dict(CalendarType=1,SwitchGDD=0,Tbase=10,Tupp=30,EmergenceCD=7,MaxRootingCD=67,SenescenceCD=76,MaturityCD=111,HIstartCD=54,FloweringCD=10,YldFormCD=42,Zmin=.1,Zmax=.5,PlantPop=70000,SeedSize=6.5,HI0=.5)
# Soil saturation is a derived scenario, not an observed parameter. 2650 kg/m3
# mineral particle density is an explicit convention; alternative saturation
# values are sensitivity cases, not uncertainty intervals.
saturation=[1-bd/2650 for bd in [1580,1620,1630,1670]]
base_crop=Crop('Maize',planting_date='12/16');cc0=6.5*70000/1e8
overrides['CGC_CD']=float(np.log(.25*base_crop.CCx**2/(cc0*(base_crop.CCx-.98*base_crop.CCx)))/(60-7))
parameter_record={'package':'aquacrop','version':'3.0.12','implementation':'AquaCrop-OSPy, unofficial port; fertility/salinity not simulated','overrides':overrides,'overrideSources':{'Tbase,Tupp,EmergenceCD,MaxRootingCD,SenescenceCD,HIstartCD,FloweringCD,YldFormCD,SeedSize,HI0':'Water SA Table1; HI0 reference 0.5, not treatment observed HI','CGC_CD':'Derived algebraically from Table1 max canopy DAP60 and emergence DAP7 using the versioned 98% CCx calendar equation; CCx=.96 is uncalibrated package default, not fit to yield','MaturityCD':'111-day observed field duration Table4, explicit comparison calendar; actual model death/harvest may be earlier','PlantPop':'70000 plants/ha Methods, not 62500 used in original AquaCrop Table1','Zmin,Zmax':'same .1–.5 m reconstructed root range as RUE; actual Table1 .3–1m cannot be fully supplied by published 0–.5m hydraulics'},'soil':{'thetaSat':saturation,'particleDensityReference':'https://www.fao.org/soils-portal/data-hub/soil-properties/physical-properties/en/','saturationStatus':'derived scenario from bulk density and assumed mineral particle density 2650 kg/m3; not measured','CN':66,'REW':2,'CN_REW_source':'Water SA Table1','ksatMmDay':[714.24,574.81,693.58,592.7],'ksatSource':'Water SA Table2','dzM':[.05]*12,'profileDepthM':.6,'measuredDepthM':.5,'extrapolatedBottomM':.1,'bottomExtrapolationStatus':'Model requires a 0.1m buffer below 0.5m roots; last measured horizon hydraulic parameters extended explicitly, not observed','initialMoisture':c['soil']['layers'],'initialStatus':'same FC scenario in upper two horizons as RUE; actual published values tested separately'},'defaults':vars(Crop('Maize',planting_date='12/16')),'forcing':'identical NASA weather and announced stage-total calendars; no extra water-loss multiplier','radiation':'not a direct input to AquaCrop biomass; output is normalized-transpiration WP, unlike RUE','biomassConversion':'package biomass in g/m2 multiplied by 10 to kg/ha; checked against dry grain = biomass * adjusted HI','massBasis':'Dry yield converted to grain at 13% moisture by /0.87; package FreshYield not used'}
results=[]
selected=[r for r in rue['records'] if r['experiment']=='B-nutrition-unlimited']
# Two water controls and above-FC state are explicit diagnostics outside the
# main matched-forcing comparison, not fitted to measured yields.
selected += [r|{'calendar':'daily-default-CGC','variant':'default-CGC'} for r in selected if r['calendar']=='daily']
selected += [rue['records'][0] | {'calendar':'daily-published-initial','variant':'published-initial'},rue['records'][0] | {'calendar':'daily-paper-phenology100','variant':'paper-phenology'}]
for record in selected:
 soil=Soil('custom',dz=[.05]*12,cn=66,rew=2)
 for li,(l,ksat,sat) in enumerate(zip(c['soil']['layers'],[714.24,574.81,693.58,592.7],saturation)):soil.add_layer(thickness=l['thicknessM']+(.1 if li==3 else 0),thWP=l['thetaWP'],thFC=l['thetaFC'],thS=sat,Ksat=ksat,penetrability=100)
 params=dict(overrides)
 if record.get('variant')=='default-CGC':params['CGC_CD']=float(base_crop.CGC_CD)
 if record.get('variant')=='paper-phenology':params['MaturityCD']=100
 crop=Crop('Maize',planting_date='12/16',harvest_date='04/05',**params)
 initial=source['published']['initialTheta'] if record.get('variant')=='published-initial' else [l['initialTheta'] for l in c['soil']['layers']]
 init=InitialWaterContent(wc_type='Num',method='Layer',depth_layer=[1,2,3,4],value=initial)
 schedule=pd.DataFrame([{'Date':pd.Timestamp(e['date']),'Depth':e['amount']} for e in record['forcing']])
 irr=IrrigationManagement(3,Schedule=schedule,AppEff=100,MaxIrr=2000,MaxIrrSeason=10000)
 model=AquaCropModel(sim_start_time='2017/12/16',sim_end_time='2018/04/05',weather_df=weather.copy(),soil=soil,crop=crop,initial_water_content=init,irrigation_management=irr)
 model.run_model(till_termination=True)
 crop_growth=model.get_crop_growth();flux=model.get_water_flux();storage=model.get_water_storage();stats=model.get_simulation_results().iloc[0]
 # Preallocated rows after model termination contain zero and are NOT valid days.
 valid=crop_growth['dap']>0;cg=crop_growth.loc[valid].reset_index(drop=True);fl=flux.loc[valid].reset_index(drop=True);st=storage.loc[valid].reset_index(drop=True)
 days=[]
 previous_storage=sum(l['thicknessM']*v*1000 for l,v in zip(c['soil']['layers'],initial))+.1*initial[-1]*1000;previous_surface=0.0
 for k,g in cg.iterrows():
  f=fl.iloc[k];z=st.iloc[k];idx=int(g['time_step_counter']);d={'date':(pd.Timestamp(c['sowingDate'])+pd.Timedelta(days=idx)).date().isoformat(),'dap':int(g['dap']),'rootM':float(g['z_root']),'canopyCover':float(g['canopy_cover']),'canopyNoStress':float(g['canopy_cover_ns']),'biomassKgHa':10*float(g['biomass']),'biomassNoStressKgHa':10*float(g['biomass_ns']),'HIreference':float(g['harvest_index']),'HIadjusted':float(g['harvest_index_adj']),'dryYieldTonneHa':float(g['DryYield']),'irrigationModelMm':float(f['IrrDay']),'infiltrationMm':float(f['Infl']),'runoffMm':float(f['Runoff']),'deepDrainageMm':float(f['DeepPerc']),'evaporationMm':float(f['Es']),'evaporationPotentialMm':float(f['EsPot']),'transpirationMm':float(f['Tr']),'transpirationPotentialMm':float(f['TrPot']),'waterInRootZoneMm':float(f['Wr']),'surfaceStorageMm':float(f['surface_storage']),'theta':[float(z['th'+str(j)]) for j in range(1,13)]};full_storage=sum(d['theta'])*.05*1000;rain=float(weather.iloc[idx]['Precipitation']);d['rainMm']=rain;d['fullSoilStorageMm']=full_storage;d['waterBalanceResidualMm']=previous_storage+previous_surface+rain+d['irrigationModelMm']-d['runoffMm']-d['deepDrainageMm']-d['evaporationMm']-d['transpirationMm']-full_storage-d['surfaceStorageMm'];previous_storage=full_storage;previous_surface=d['surfaceStorageMm'];days.append(d)
 if max(abs(d['waterBalanceResidualMm']) for d in days)>1e-6:raise RuntimeError('AquaCrop full-profile water balance failed')
 dry=float(stats['Dry yield (tonne/ha)']);
 if abs(dry*1000-days[-1]['biomassKgHa']*days[-1]['HIadjusted'])>1e-5:raise RuntimeError('AquaCrop biomass g/m2 to kg/ha mass check failed')
 observed=record['observedKgHa']
 results.append({'calendar':record['calendar'],'treatment':record['treatment'],'variant':record.get('variant','matched-forcing'),'observedKgHa':observed,'yieldDryTonneHa':dry,'yieldAt13PercentKgHa':dry/.87*1000,'biomassKgHa':days[-1]['biomassKgHa'],'HIadjusted':days[-1]['HIadjusted'],'harvestDate':str(stats['Harvest Date (YYYY/MM/DD)']),'daysSimulated':len(days),'configuredNoStressMaxCanopyDAP':round(7+float(np.log(.25*base_crop.CCx**2/(cc0*(base_crop.CCx-.98*base_crop.CCx))))/params['CGC_CD']),'actualPeakCanopyDate':max(days,key=lambda d:d['canopyCover'])['date'],'plannedIrrigationMm':sum(e['amount'] for e in record['forcing']),'deliveredIrrigationMm':float(stats['Seasonal irrigation (mm)']),'transpirationMm':sum(d['transpirationMm'] for d in days),'transpirationPotentialMm':sum(d['transpirationPotentialMm'] for d in days),'evaporationMm':sum(d['evaporationMm'] for d in days),'deepDrainageMm':sum(d['deepDrainageMm'] for d in days),'runoffMm':sum(d['runoffMm'] for d in days),'maxWaterBalanceResidualMm':max(abs(d['waterBalanceResidualMm']) for d in days),'days':days})
 print(json.dumps({k:v for k,v in results[-1].items() if k!='days'}),flush=True)
contrasts=[]
for cal in sorted(set(r['calendar'] for r in results if r['variant']=='matched-forcing')):
 rs=[r for r in results if r['calendar']==cal];fi=next(r for r in rs if r['treatment']=='FI');es=[r['yieldAt13PercentKgHa']-r['observedKgHa'] for r in rs];rmse=(sum(e*e for e in es)/3)**.5
 contrasts.append({'calendar':cal,'n':3,'maeKgHa':sum(abs(e) for e in es)/3,'rmseKgHa':rmse,'biasKgHa':sum(es)/3,'nrmsePercent':100*rmse/(sum(r['observedKgHa'] for r in rs)/3),'ratios':{r['treatment']:r['yieldAt13PercentKgHa']/fi['yieldAt13PercentKgHa'] for r in rs},'biomassRatios':{r['treatment']:r['biomassKgHa']/fi['biomassKgHa'] for r in rs}})
def encode(x):
 if isinstance(x,np.ndarray):return x.tolist()
 if isinstance(x,(np.floating,np.integer)):return x.item()
 raise TypeError(str(type(x)))
output={'parameters':parameter_record,'protocolSha256':hashlib.sha256((folder/'PROTOCOL.md').read_bytes()).hexdigest(),'limits':['No calibration; no validation. All matched scenarios omit fertility stress in AquaCrop.','Above-FC initial condition runs require assumed saturation and the versioned internal drainage law; no observed saturation inferred.','Actual early model harvest can leave some announced field irrigation after harvest, explicitly reported.','RUE fAPAR and AquaCrop canopy cover are not interchangeable quantities; no equality of these variables assumed.'],'results':results,'contrasts':contrasts}
with gzip.open(folder/'aquacrop-daily.json.gz','wt') as f:json.dump(output,f,default=encode)
(folder/'aquacrop-summary.json').write_text(json.dumps(output|{'results':[{k:v for k,v in r.items() if k!='days'} for r in results]},default=encode,indent=2)+'\n')
