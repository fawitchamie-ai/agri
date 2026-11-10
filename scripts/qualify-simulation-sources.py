"""Read-only source qualification. No fitting or forced conversion to grain t/ha."""
from pathlib import Path
from collections import defaultdict, Counter
import csv, hashlib, json
from statistics import mean
from openpyxl import load_workbook
from docx import Document
folder=Path('research-data/simulation-audit/2026-11-10')
w=load_workbook(folder/'sekou-maize-growth.xlsx',read_only=True,data_only=True)
summary={'source':'10.5281/zenodo.14357601','license':'CC-BY-4.0','sheets':{},'groups':[], 'limits':['Fresh cob weights in grams, not dry grain yield; do not convert to t/ha without grain fraction, grain moisture and compatible area denominator.','W1/W2 were conducted in separate 2023 phases, not independent site-years.','Greenhouse microclimate, exact daily irrigation, accessible NPK supply and RUE profile missing; no integrated-model validation metric calculated.']}
for s in w:
 rows=list(s.values);nonempty=[r for r in rows[1:] if any(v is not None for v in r)]
 summary['sheets'][s.title]={'header':list(rows[0]),'dataRows':len(nonempty),'blankRows':len(rows)-1-len(nonempty)}
rows=[r for r in w['Yield parameters'].values][1:];groups=defaultdict(list);identities=Counter();bad=[]
for i,r in enumerate(rows,2):
 if not any(v is not None for v in r):continue
 weather,block,rep,fert,*_=r
 if weather not in ['W1','W2'] or not isinstance(fert,str):bad.append(i);continue
 groups[(weather,fert.strip())].append(r);identities[(weather,block,rep,fert.strip())]+=1
for (weather,fert),rs in sorted(groups.items()):
 vals=[r[9] for r in rs if isinstance(r[9],(int,float))]
 summary['groups'].append({'weather':weather,'fertilizer':fert,'rows':len(rs),'freshCobWeightNumericN':len(vals),'freshCobWeightMissingOrText':len(rs)-len(vals),'meanFreshCobG':mean(vals) if vals else None})
summary['duplicateIdentityKeys']=[{'key':list(k),'rows':n} for k,n in identities.items() if n>1]
summary['unclassifiedRows']=bad
(folder/'sekou-qualification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
d=Document(folder/'ina-supplement.docx')
with (folder/'ina-table-s1.csv').open('w') as f:
 writer=csv.writer(f,lineterminator="\n");writer.writerows([[c.text for c in row.cells] for row in d.tables[0].rows])
manifest=[]
for name,url,license in [
 ('togo-water-sa-2020.pdf','https://www.scielo.org.za/pdf/wsa/v46n1/15.pdf','PDF declares CC-BY-4.0; journal landing page displays inconsistent CC-BY-NC wording; raw PDF kept local, no commercial parameter licensing assumed'),
 ('nasa-power-20171216-20180405.json','https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MIN,T2M_MAX,T2MDEW,RH2M,WS2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,PS&community=AG&latitude=11&longitude=0&start=20171216&end=20180405&format=JSON&time-standard=UTC','NASA POWER public data; source attribution; gridded estimate not field measurement'),
 ('ina-supplement.docx','https://ndownloader.figshare.com/files/14274587','CC-BY-4.0, figshare article 7678853'),
 ('sekou-maize-growth.xlsx','https://zenodo.org/api/records/14357601/files/Maize_growth_data.xlsx/content','CC-BY-4.0')]:
 p=folder/name;b=p.read_bytes();manifest.append({'file':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'md5':hashlib.md5(b).hexdigest(),'url':url,'license':license,'acquiredOn':'2026-11-10','status':'downloaded and read'})
(folder/'sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
