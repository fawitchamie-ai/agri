"""Documentary replay of the published Togo recalibration with official AquaCrop.

No yield fitting. Supply official v7.3_typofix testcase directory as argument.
"""
from pathlib import Path
from datetime import datetime, timedelta
import gzip, hashlib, json, math, shutil, subprocess, sys, tempfile
from statistics import mean
from scipy.optimize import brentq

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'research-data/togo-fertility/2026-11-11'
TEMPLATE = Path(sys.argv[1]).resolve()
if not (TEMPLATE/'aquacrop').exists():
    candidates=list(TEMPLATE.glob('*/testcase'))
    if len(candidates)!=1:raise SystemExit('Supply one official testcase or its unambiguous parent directory.')
    TEMPLATE=candidates[0]
source = json.load(gzip.open(ROOT / 'research-data/simulation-audit/2026-11-10/after.json.gz'))
crop_defaults = json.load(open(ROOT / 'research-data/togo-causal/2026-11-10/aquacrop-summary.json'))['parameters']['defaults']
base = source['cases'][0]['config']
pub = source['published']
sow = datetime.fromisoformat(base['sowingDate'])
n = len(base['weather'])
calendars = [('daily', 1, 0), ('pulse3-start', 3, 0), ('pulse3-end', 3, 2), ('pulse7-start', 7, 0), ('pulse7-end', 7, 6)]
ccx = .78 / .99
cc0 = 6.5 * 70000 / 1e8
growth_log = math.log(.25 * ccx**2 / (cc0 * (.02 * ccx)))
cgc = growth_log / (69-8)
gdd_cgc = growth_log / (1199-135)

def shape_for_reduction(reduction):
    # global.f90: KsAny and CropStressParametersSoilFertility, at degree50.
    def reduction_at(s):
        return math.expm1(.5*s) / math.expm1(s) if abs(s) > 1e-8 else .5
    shape = brentq(lambda s: reduction_at(s)-reduction, -30, 30)
    assert abs(reduction_at(shape)-reduction) < 1e-10
    return shape

shapes = {key: shape_for_reduction(value) for key, value in [
    ('canopy expansion', .15), ('maximum canopy cover', .01),
    ('crop Water Productivity', .70), ('decline of canopy cover', .42)]}

def irrigation(index, interval, phase):
    events = []; offset = 0
    for days, total in zip(pub['stageDays'], pub['irrigationMm'][index]):
        daps = [offset+i+1 for i in range(days) if i % interval == phase]
        assert daps
        events.extend((dap, total/len(daps)) for dap in daps)
        assert abs(sum(v for dap, v in events if offset < dap <= offset+days)-total) < 1e-7
        offset += days
    return events

work = Path(tempfile.mkdtemp(prefix='togo-official-'))
for folder in ['DATA', 'PARAM', 'SIMUL', 'LIST', 'OUTP']:
    (work/folder).mkdir()
shutil.copytree(TEMPLATE/'SIMUL', work/'SIMUL', dirs_exist_ok=True)
shutil.copy(TEMPLATE/'PARAM/Ottawa.PPn', work/'PARAM/TOGO.PPn')
shutil.copy(TEMPLATE/'aquacrop', work/'aquacrop')
(work/'aquacrop').chmod(0o755)
(work/'LIST/ListProjects.txt').write_text('TOGO.PRM\n')

def run(index, calendar, fertility, mode):
    _, interval, phase = calendar
    events = irrigation(index, interval, phase)
    def climate(name, values):
        (work/'DATA'/name).write_text(f'Togo NASA local daily retrospective\n1\n{sow.day}\n{sow.month}\n{sow.year}\n\nDaily records\n=============\n'+''.join(f'{v}\n' for v in values))
    climate('TOGO.ETo', [w['et0Mm'] for w in base['weather']])
    climate('TOGO.PLU', [w['rainMm'] for w in base['weather']])
    climate('TOGO.Tnx', [f"{w['temperatureMinC']} {w['temperatureMaxC']}" for w in base['weather']])
    (work/'DATA/TOGO.CLI').write_text('Togo\n7.3\nTOGO.Tnx\nTOGO.ETo\nTOGO.PLU\nMaunaLoa.CO2\n')
    (work/'DATA/TOGO.IRR').write_text('Stage totals; hypothetical dates; 100% net\n7.3\n5\n30\n1\n-9\nDay Depth EC\n=============\n'+''.join(f'{dap} {depth:.9f} 0\n' for dap, depth in events))
    soil = ['Togo thesis measured saturation and retention', '7.3', '46', '2', '4', '-9', 'Thickness Sat FC WP Ksat Penetrability Gravel CRa CRb', 'm vol% mm/day']
    sat = [34.87, 36.51, 39.91, 41.35]
    ksat = [714.24, 574.81, 693.58, 592.70]
    for j, l in enumerate(base['soil']['layers']):
        soil.append(f"{l['thicknessM']} {sat[j]} {l['thetaFC']*100} {l['thetaWP']*100} {ksat[j]} 100 0 -.39 1.25 sandy_loam")
    (work/'DATA/TOGO.SOL').write_text('\n'.join(soil)+'\n')
    sw0 = ['Published initial theta', '7.3', '-9', '0', '-9', '0', '0', '0', '4', 'Depth Theta EC', 'm percent dS/m', '===========']
    sw0 += [f"{l['thicknessM']} {theta*100} 0" for l, theta in zip(base['soil']['layers'], pub['initialTheta'])]
    (work/'DATA/TOGO.SW0').write_text('\n'.join(sw0)+'\n')
    lines = (TEMPLATE/'DATA/Ottawa.MAN').read_text().splitlines()
    for j, line in enumerate(lines):
        if 'Degree of soil fertility stress' in line:
            lines[j] = f"{50 if fertility else 0} : Degree of soil fertility stress (%) - internal representation coordinate"
        if 'Multiple cuttings are considered' in line:
            lines[j] = '0 : Multiple cuttings NOT considered'
    (work/'DATA/TOGO.MAN').write_text('\n'.join(lines)+'\n')
    replacements = {
        'Determination of crop cycle': 1 if mode=='calendar' else 0,
        'Base temperature': 10, 'Upper temperature': 30,
        'Total length of crop cycle in growing degree-days': 1898,
        'for canopy expansion (p-exp) - Upper': .14,
        'for canopy expansion (p-exp) - Lower': .72,
        'for water stress coefficient for canopy expansion': 2.9,
        'fraction for stomatal control': .69,
        'for water stress coefficient for stomatal control': 6,
        'for canopy senescence (p - sen)': .69,
        'for water stress coefficient for canopy senescence': 2.7,
        'for pollination (p - pol)': .8,
        'Considered soil fertility stress for calibration': 50,
        'Minimum air temperature below which pollination': int(crop_defaults['Tmin_lo']),
        'Maximum air temperature above which pollination': int(crop_defaults['Tmax_up']),
        'Minimum growing degrees required for full crop transpiration': crop_defaults['GDD_up'],
        'Crop coefficient when canopy is complete': crop_defaults['Kcb'],
        # Official7.3 changed daily Kc decline into cumulative decrease.
        # Keep its generic11%; OSPy's fage=.3%/day is NOT this quantity.
        'Cumulative decrease (%) at maturity': 11,
        'Minimum effective rooting depth (m)': .3, 'Maximum effective rooting depth': .5,
        'Number of plants per hectare': 70000,
        'Soil surface covered by an individual seedling': 6.5,
        'Canopy growth coefficient (CGC)': cgc, 'Maximum canopy cover (CCx)': ccx,
        'Canopy decline coefficient (CDC)': crop_defaults['CDC_CD'],
        'Calendar Days: from sowing to emergence': 8,
        'Calendar Days: from sowing to maximum rooting': 86,
        'Calendar Days: from sowing to start senescence': 90,
        'Calendar Days: from sowing to maturity': 111,
        'Calendar Days: from sowing to flowering': 66,
        'Length of the flowering stage (days)': 18,
        'Building up of Harvest Index starting': 39,
        'Water Productivity normalized for ETo and CO2 (WP*) (gram/m2)': 33.7,
        'Reference Harvest Index': 26,
        'Possible increase (%) of HI due to water stress': int(crop_defaults['dHI_pre']),
        'Coefficient describing positive impact on HI': crop_defaults['a_HI'],
        'Coefficient describing negative impact on HI': crop_defaults['b_HI'],
        'Allowable maximum increase (%)': int(crop_defaults['dHI0']),
        'GDDays: from sowing to emergence': 135,
        'GDDays: from sowing to maximum rooting': 1257,
        'GDDays: from sowing to start senescence': 1408,
        'GDDays: from sowing to maturity': 1898,
        'GDDays: from sowing to flowering': 1018,
        'Length of the flowering stage (growing degree days)': 183,
        'CGC for GGDays': gdd_cgc,
        'CDC for GGDays': crop_defaults['CDC_CD']*(111-90)/(1898-1408),
        'GDDays: building-up of Harvest Index': 778,
        'dry matter content (%) of fresh yield': 100,
    }
    text = (work/'SIMUL/DEFAULT.CRO').read_text().splitlines()
    matched = set()
    for j, line in enumerate(text):
        for key, value in replacements.items():
            if key in line:
                text[j] = f'{value} : '+line.split(':', 1)[1]; matched.add(key); break
        if 'Shape factor for the response of' in line and 'soil fertility stress' in line:
            for key, value in shapes.items():
                if key in line:
                    text[j] = f'{value:.9f} : '+line.split(':',1)[1]
    assert matched == set(replacements), set(replacements)-matched
    (work/'DATA/TOGO.CRO').write_text('\n'.join(text)+'\n')
    first = (sow-datetime(1901,1,1)).days+1
    prm = ['Togo documentary replay', '7.3', '1', str(first), str(first+n-1), str(first), str(first+n-1)]
    sections = [('Climate','TOGO.CLI','./DATA/'), ('Temperature','TOGO.Tnx','./DATA/'), ('ETo','TOGO.ETo','./DATA/'), ('Rain','TOGO.PLU','./DATA/'), ('CO2','MaunaLoa.CO2','./SIMUL/'), ('Calendar','(None)','(None)'), ('Crop','TOGO.CRO','./DATA/'), ('Irrigation','TOGO.IRR','./DATA/'), ('Management','TOGO.MAN','./DATA/'), ('Soil','TOGO.SOL','./DATA/'), ('Groundwater','(None)','(None)'), ('Initial','TOGO.SW0','./DATA/'), ('Off-season','(None)','(None)'), ('Observations','(None)','(None)')]
    for label, file, directory in sections:
        prm += ['-- '+label, file, f"'{directory}'" if directory!='(None)' else directory]
    (work/'LIST/TOGO.PRM').write_text('\n'.join(prm)+'\n')
    process = subprocess.run(['./aquacrop'], cwd=work, capture_output=True, text=True, timeout=10)
    if process.returncode:
        raise RuntimeError(process.stdout[-2000:]+process.stderr[-500:])
    lines = (work/'OUTP/TOGOPRMseason.OUT').read_text().splitlines()
    header = next(l.split() for l in lines if 'RunNr' in l)
    values = next(l.split() for l in lines if l.strip().startswith('Tot('))
    result = dict(zip(header, values))
    keys = ['Rain', 'ETo', 'Irri', 'Runoff', 'Drain', 'E', 'Tr', 'BioMass', 'HI', 'Y(dry)', 'ExpStr', 'StoStr', 'FertStr']
    days = []
    previous_stock=sum(l['thicknessM']*theta*1000 for l,theta in zip(base['soil']['layers'],pub['initialTheta']))
    previous_surface=0.
    for line in (work/'OUTP/TOGOPRMday.OUT').read_text().splitlines():
        v = line.split()
        if len(v)>42 and v[0].isdigit() and v[1].isdigit():
            stock,rain,irr,surface,runoff,drain,capillary=(float(v[k]) for k in [5,6,7,8,10,11,12])
            e,tr=float(v[15]),float(v[18])
            residual=previous_stock+previous_surface+rain+irr+capillary-runoff-drain-e-tr-stock-surface
            # Nine independently rounded0.1mm outputs can contribute ±0.45mm.
            if abs(residual)>.451:raise RuntimeError('Official rounded daily water balance exceeds quantization bound: '+str(residual))
            previous_stock,previous_surface=stock,surface
            days.append({'date': datetime(int(v[2]),int(v[1]),int(v[0])).date().isoformat(), 'dap': int(v[3]) if int(v[3])>0 else None, 'E':e, 'Tr':tr, 'ET':float(v[21]), 'gdd':float(v[23]), 'rootM':float(v[24]) if float(v[24])>=0 else None, 'cover':float(v[30])/100, 'biomassKgHa':float(v[39])*1000, 'HI':float(v[40])/100 if float(v[40])>=0 else None, 'grainDryKgHa':float(v[41])*1000, 'profileStockMm':stock, 'irrigationMm':irr, 'rainMm':rain, 'drainageMm':drain, 'runoffMm':runoff, 'roundedWaterBalanceResidualMm':residual})
    key = f'{mode}-{calendar[0]}-fert{int(fertility)}-{index}'
    if index==0 and calendar[0]=='daily':
        dest = OUT/'inputs'/f'{mode}-fert{int(fertility)}'; dest.mkdir(parents=True,exist_ok=True)
        for filename in ['TOGO.CRO','TOGO.MAN','TOGO.SOL','TOGO.SW0']:
            shutil.copy(work/'DATA'/filename, dest/filename)
    mature=mode=='calendar' or sum(d['gdd'] for d in days)>=1898-1
    return {'id': key, 'mode':mode, 'calendar':calendar[0], 'fertility':fertility, 'treatment':['FI','80','60'][index], 'observedKgHa':pub['observedKgHa'][index], 'maturityReached':mature, 'grainKgHaAt13Percent':float(result['Y(dry)'])*1000/.87 if mature else None, 'plannedIrrigationMm':sum(v for _,v in events), 'roundedIrrigationMm':sum(math.floor(v+.5) for _,v in events), 'simulatedDays':len(days), 'cropDaysWithValidRoot':sum(d['rootM'] is not None for d in days), 'maxRoundedWaterBalanceResidualMm':max(abs(d['roundedWaterBalanceResidualMm']) for d in days), 'waterBalancePrecision':'Rounded output0.1mm; maximum theoretical daily quantization residual0.45mm, not a predictive uncertainty.', 'lastDay':days[-1]['date'], 'gddAtCutoff':sum(d['gdd'] for d in days), 'official':{k:float(result[k]) for k in keys} if mature else None, 'partialAtCutoff':days[-1] if not mature else None, 'days':days}

records = []
try:
    for mode in ['calendar','gdd']:
        for calendar in calendars:
            for fertility in [False,True]:
                rows = [run(index, calendar, fertility, mode) for index in range(3)]
                records += rows
                print(mode, calendar[0], fertility, [(r['treatment'],round(r['grainKgHaAt13Percent']) if r['maturityReached'] else 'immature',round(sum(d['Tr'] for d in r['days']),1),r['days'][-1]['HI']) for r in rows],flush=True)
    summaries = []
    for mode in ['calendar','gdd']:
        for calendar,_,_ in calendars:
            for fertility in [False,True]:
                rows=[r for r in records if r['mode']==mode and r['calendar']==calendar and r['fertility']==fertility]
                es=[r['grainKgHaAt13Percent']-r['observedKgHa'] for r in rows if r['maturityReached']]
                metrics={'n':len(es),'maeKgHa':mean(abs(e) for e in es),'rmseKgHa':math.sqrt(mean(e*e for e in es)),'biasKgHa':mean(es),'nrmsePercent':100*math.sqrt(mean(e*e for e in es))/mean(r['observedKgHa'] for r in rows),'grainRatios':[r['grainKgHaAt13Percent']/rows[0]['grainKgHaAt13Percent'] for r in rows]} if es else {'n':0,'missing':'Maturity not reached with this weather by field harvest date; partial biomass is not a zero grain harvest.'}
                summaries.append({'mode':mode,'calendar':calendar,'fertility':fertility,**metrics})
    output={'engine':'official AquaCrop 7.3 v7.3_typofix','protocolSha256':hashlib.sha256((OUT/'PROTOCOL.md').read_bytes()).hexdigest(),'freeParameters':[],'parameters':{'CCx':ccx,'CGC':cgc,'GDD_CGC':gdd_cgc,'fertilityShapes':shapes,'fertilityCoordinate':50,'HI':.26,'WP':33.7},'summaries':summaries,'records':[{k:v for k,v in r.items() if k!='days'} for r in records]}
    (OUT/'official-summary.json').write_text(json.dumps(output,indent=2)+'\n')
    with gzip.open(OUT/'official-daily.json.gz','wt') as f:
        json.dump({'records':records},f)
    print('Work directory:',work)
except Exception:
    print('Failed work directory:',work)
    raise
