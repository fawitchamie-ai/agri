"""Actual AquaCrop 7.3 executable on the SAME LIRF weather/net irrigation/soil scenario.

Pass the unpacked official testcase directory (with aquacrop binary) as argument.
Only 2012 FI cover/biomass/grain set the four shared effective crop coefficients.
This local benchmark is NOT a connected application service or an African profile.
"""
from pathlib import Path
from datetime import datetime
from statistics import mean
import gzip,json,sys,shutil,subprocess,tempfile,math,re
import numpy as np
from scipy.optimize import least_squares

template=Path(sys.argv[1]).resolve()
folder=Path('research-data/lirf/2026-11-10')
data=json.load(gzip.open(folder/'adapter.json.gz','rt'))
defaults=json.load(open('research-data/togo-causal/2026-11-10/aquacrop-summary.json'))['parameters']['defaults']
fi=next(r for r in data['cases'] if r['year']==2012 and r['treatment']=='100/100')
cc0=6.5*80000/1e8
def cover(t,cgc,cdc,n,emergence):
    if t<=emergence:return 0
    def grow(day):
        v=cc0*math.exp(cgc*day)
        return v if v<=.96/2 else .96-.25*.96**2/cc0*math.exp(-cgc*day)
    senescence=round(.8*n)
    if t<senescence:return grow(t-emergence)
    peak=grow(senescence-emergence)
    return max(0,peak*(1-.05*(math.exp((t-senescence)*3.33*cdc/(peak+2.29))-1)))
obs=fi['coverObservations']
n=len(fi['weather'])
fit=least_squares(lambda p:[cover((datetime.fromisoformat(o['date'])-datetime.fromisoformat(fi['sowingDate'])).days+1,*p,n,14)-o['cover'] for o in obs],x0=[.1,.08],bounds=([.01,.005],[.25,.25]))
cgc,cdc=fit.x
work=Path(tempfile.mkdtemp(prefix='lirf-official-'))
try:
    for name in ['DATA','SIMUL','PARAM','LIST','OUTP']:(work/name).mkdir()
    shutil.copytree(template/'SIMUL',work/'SIMUL',dirs_exist_ok=True)
    shutil.copy(template/'aquacrop',work/'aquacrop');(work/'aquacrop').chmod(0o755)
    shutil.copy(template/'PARAM/Ottawa.PPn',work/'PARAM/LIRF.PPn')
    (work/'LIST/ListProjects.txt').write_text('LIRF.PRM\n')
    # No fertilization stress is imposed: diagnostic match with nonlimiting NPK.
    def run(row,wp,hi):
        sow=datetime.fromisoformat(row['sowingDate']);end=datetime.fromisoformat(row['maturityDate']);n=(end-sow).days+1
        first=(sow-datetime(1901,1,1)).days+1;last=first+n-1
        def climate(name,values):
            (work/'DATA'/name).write_text(f'LIRF local MST\n1\n{sow.day}\n{sow.month}\n{sow.year}\n\nDaily records\n=============\n'+''.join(f'{v}\n' for v in values))
        climate('LIRF.ETo',[w['et0Mm'] for w in row['weather']])
        climate('LIRF.PLU',[w['rainMm'] for w in row['weather']])
        climate('LIRF.Tnx',[f"{w['temperatureMinC']} {w['temperatureMaxC']}" for w in row['weather']])
        (work/'DATA/LIRF.CLI').write_text('LIRF\n7.3\nLIRF.Tnx\nLIRF.ETo\nLIRF.PLU\nMaunaLoa.CO2\n')
        irrigation=[f"{(datetime.fromisoformat(e['date'])-sow).days+1} {e['amount']} 0" for e in row['events']]
        (work/'DATA/LIRF.IRR').write_text('LIRF effective irrigation, not gross\n7.3\n5\n30\n1\n-9\nDay Depth EC\n=============\n'+'\n'.join(irrigation)+'\n')
        layers=row['soil']['layers']
        sol=['LIRF FC measured; WP and saturation are scenarios','7.3','46','8','4','-9','Thickness Sat FC WP Ksat Penetrability Gravel CRa CRb','m vol% mm/day']
        for l in layers:sol.append(f"{l['thicknessM']} {max(42, l['thetaFC']*100+10)} {l['thetaFC']*100} {l['thetaWP']*100} 1000 100 0 -0.39 1.25 sandy_loam")
        (work/'DATA/LIRF.SOL').write_text('\n'.join(sol)+'\n')
        sw0=['LIRF reconstructed theta, not measured at sowing','7.3','-9','0','-9','0','0','0','4','Depth Theta EC','m percent dS/m','===========']+[f"{l['thicknessM']} {l['initialTheta']*100} 0" for l in layers]
        (work/'DATA/LIRF.SW0').write_text('\n'.join(sw0)+'\n')
        # Official generic file structure, with versioned Maize defaults and shared fit.
        text=(work/'SIMUL/DEFAULT.CRO').read_text()
        replacements={
          'Base temperature':8,'Upper temperature':30,'for canopy expansion (p-exp) - Upper':.14,'for canopy expansion (p-exp) - Lower':.72,
          'for water stress coefficient for canopy expansion':2.9,'fraction for stomatal control':.69,'for water stress coefficient for stomatal control':6,
          'for canopy senescence (p - sen)':.69,'for water stress coefficient for canopy senescence':2.7,'for pollination (p - pol)':.8,
          'Crop coefficient when canopy is complete':defaults['Kcb'],'Minimum effective rooting depth (m)':.08,'Maximum effective rooting depth':1.05,
          'Number of plants per hectare':80000,'Soil surface covered by an individual seedling':6.5,
          'Canopy growth coefficient (CGC)':float(cgc),'Maximum canopy cover (CCx)':.96,'Canopy decline coefficient (CDC)':float(cdc),
          'Calendar Days: from sowing to emergence':14 if row['year']==2012 else 8,
          'Calendar Days: from sowing to maximum rooting':round(.6*n),'Calendar Days: from sowing to start senescence':round(.8*n),
          'Calendar Days: from sowing to maturity':n,'Calendar Days: from sowing to flowering':round(.52*n),
          'Length of the flowering stage (days)':10,'Building up of Harvest Index starting':round(.38*n),
          'Water Productivity normalized for ETo and CO2 (WP*) (gram/m2)':wp,'Reference Harvest Index':round(hi*100),
          'dry matter content (%) of fresh yield':100}
        lines=text.splitlines()
        for i,line in enumerate(lines):
            for key,value in replacements.items():
                if key in line:lines[i]=f'{value} : '+line.split(':',1)[1];break
        (work/'DATA/LIRF.CRO').write_text('\n'.join(lines)+'\n')
        prm=['LIRF retrospective benchmark','7.3','1',str(first),str(last),str(first),str(last)]
        sections=[('Climate','LIRF.CLI','./DATA/'),('Temperature','LIRF.Tnx','./DATA/'),('ETo','LIRF.ETo','./DATA/'),('Rain','LIRF.PLU','./DATA/'),('CO2','MaunaLoa.CO2','./SIMUL/'),('Calendar','(None)','(None)'),('Crop','LIRF.CRO','./DATA/'),('Irrigation','LIRF.IRR','./DATA/'),('Management','(None)','(None)'),('Soil','LIRF.SOL','./DATA/'),('Groundwater','(None)','(None)'),('Initial','LIRF.SW0','./DATA/'),('Off-season','(None)','(None)'),('Observations','(None)','(None)')]
        for label,file,directory in sections:prm += ['-- '+label,file,"'"+directory+"'" if directory!='(None)' else directory]
        (work/'LIST/LIRF.PRM').write_text('\n'.join(prm)+'\n')
        run=subprocess.run(['./aquacrop'],cwd=work,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=8,text=True)
        if run.returncode:raise RuntimeError(run.stdout[-1500:])
        lines=(work/'OUTP/LIRFPRMseason.OUT').read_text().splitlines()
        header=next(l.split() for l in lines if 'RunNr' in l)
        vals=next(l.split() for l in lines if l.strip().startswith('Tot('));result=dict(zip(header,vals))
        keys=['Rain','ETo','Irri','Runoff','Drain','E','Tr','BioMass','HI','Y(dry)','ExpStr','StoStr','FertStr']
        dlines=(work/'OUTP/LIRFPRMday.OUT').read_text().splitlines()
        daily=[]
        for line in dlines:
            values=line.split()
            if len(values)>42 and values[0].isdigit() and values[1].isdigit():
                daily.append({'date':datetime(int(values[2]),int(values[1]),int(values[0])).date().isoformat(),'dap':int(values[3]),'evaporationMm':float(values[15]),'transpirationMm':float(values[18]),'etMm':float(values[21]),'rootM':float(values[24]),'canopyCover':float(values[30])/100,'biomassKgHa':float(values[39])*1000,'harvestIndex':float(values[40])/100,'grainDryKgHa':float(values[41])*1000})
        return {**{k:float(result[k]) for k in keys},'_days':daily}

    initial=run(fi,33.7,.48)
    observed_biomass=mean(o['biomassKgHa'] for o in fi['annualObservations'])
    observed_dry_grain=mean(o['grainKgHa'] for o in fi['annualObservations'])*.845
    wp=33.7*observed_biomass/(initial['BioMass']*1000)
    hi=observed_dry_grain/observed_biomass
    records=[]
    for row in data['cases']:
        result=run(row,wp,hi);observed=mean(o['grainKgHa'] for o in row['annualObservations'] if o['grainKgHa'] is not None)
        records.append({'id':row['id'],'year':row['year'],'treatment':row['treatment'],'observedGrainKgHa':observed,'predictedGrainKgHa':result['Y(dry)']*1000/.845,'official':result})
    def metrics(rs):
        es=[r['predictedGrainKgHa']-r['observedGrainKgHa'] for r in rs];rmse=math.sqrt(mean(e*e for e in es))
        return {'n':len(es),'maeKgHa':mean(abs(e) for e in es),'rmseKgHa':rmse,'biasKgHa':mean(es),'nrmsePercent':100*rmse/mean(r['observedGrainKgHa'] for r in rs)}
    output={'engine':'AquaCrop official 7.3 v7.3_typofix','calibration':{'training':'2012 FI only, retrospective','canopyCGC':float(cgc),'canopyCDC':float(cdc),'effectiveWP':wp,'referenceHI':hi,'initialFI':{k:v for k,v in initial.items() if k!='_days'},'canopyFitCost':float(fit.cost)},'records':records,'metricsByYear':{str(y):metrics([r for r in records if r['year']==y]) for y in [2012,2013]},'limits':['No African transfer or operational engine replacement.','Same weather, net irrigation, FC and reconstructed WP/initial theta; model root and canopy trajectories differ.','Saturation and conductivity are scenarios; neither model receives measured saturated conductivity.','Official 7.3 reads and rounds scheduled irrigation depths and HI percentage to integers; retain this difference.','Common four coefficients fit 2012 FI only; 2013 already examined during model development, not blind.','No nutrient response fitted; fertility stress zero for diagnostic equivalence.','The official model can extend its compartment grid below the supplied root profile; no measured deeper hydraulic properties are implied.','Generic maize stress coefficients from pinned versioned defaults; no US-specific genotype identification.']}
    with gzip.open(folder/'official-aquacrop-daily.json.gz','wt') as f:json.dump({'records':records},f)
    for r in records:r['official'].pop('_days',None)
    (folder/'official-aquacrop-summary.json').write_text(json.dumps(output,indent=2)+'\n')
    print(json.dumps({k:v for k,v in output.items() if k!='records'},indent=2))
finally:
    if (folder/'official-aquacrop-summary.json').exists():shutil.rmtree(work)
    else:print('Failed benchmark work directory:',work,flush=True)
