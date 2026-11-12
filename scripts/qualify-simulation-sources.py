"""Read-only source qualification. No fitting or forced conversion to grain t/ha."""
from pathlib import Path
from collections import defaultdict
import csv, hashlib, json
from statistics import mean
from openpyxl import load_workbook
from docx import Document
folder=Path('research-data/simulation-audit/2026-11-10')
w=load_workbook(folder/'sekou-maize-growth.xlsx',read_only=True,data_only=True)
summary={
 'source':'10.5281/zenodo.14357601',
 'license':'CC-BY-4.0',
 'authorClarification':{
  'receivedOn':'2026-11-12',
  'channel':'Private correspondence; contact details and message are not redistributed.',
  'freshweightCobMeaning':'Fresh mass of maize cobs after removal of the husks (spathes); it is not grain-only mass and not dry grain yield.',
  'missingValues':'Remain missing; they are not interpreted as zero.',
  'climateCompanionLead':'The author reports that climate data for the experiment are available on an associated Zenodo deposit. No exact record, DOI, or file was identified in the reply, so the companion series remains unacquired.',
  'reuse':'Exploratory research use is permitted with citation of the article and Zenodo dataset.'
 },
 'sheets':{},'groups':[],
 'outcome':{
  'column':'Freshweight_cob',
  'unit':'g per observation record',
  'basis':'Fresh maize ears/cobs after husk removal; not a kernel-only measurement.',
  'notCompatibleWith':'Dry grain t/ha without a measured grain fraction, grain moisture, and compatible harvested area denominator.',
  'missingness':'Blank cells remain null; no imputation or zero replacement.'
 },
 'experimentalUse':{
  'current':'Descriptive greenhouse treatment audit only; do not use as field-yield calibration or validation.',
  'blocker':'The plausible composite key (weather, block, repetition, fertilizer) repeats for 13 combinations, and recorded measurements differ within those combinations. The author has not confirmed whether these are distinct experimental units or a data issue. One additional row has no fertilizer label; clarify the key before fitting a treatment response.',
  'climateDesign':'W1 and W2 correspond to two separate 2023 phases, so scenario and phase/season are confounded; they are not independent site-years.'
 },
 'limits':['Fresh cob weights in grams, not dry grain yield; do not convert to t/ha without grain fraction, grain moisture and compatible area denominator.','W1/W2 were conducted in separate 2023 phases, not independent site-years.','Daily greenhouse microclimate and exact daily irrigation are not in the acquired workbook; the author reports a Zenodo climate companion but gave no exact pointer.','Accessible NPK supply, manure nutrient analysis, and a compatible RUE profile are not established; no integrated-model validation metric calculated.']
}
for s in w:
 rows=list(s.values);nonempty=[r for r in rows[1:] if any(v is not None for v in r)]
 summary['sheets'][s.title]={'header':list(rows[0]),'dataRows':len(nonempty),'blankRows':len(rows)-1-len(nonempty)}
rows=[r for r in w['Yield parameters'].values][1:];groups=defaultdict(list);identities=defaultdict(list);bad=[];blank_fertilizer_rows=[]
for i,r in enumerate(rows,2):
 if not any(v is not None for v in r):continue
 weather,block,rep,fert,*_=r
 if weather not in ['W1','W2'] or not isinstance(fert,str):
  bad.append({'excelRow':i,'weather':weather,'block':block,'repetition':rep,'fertilizer':fert,'reason':'Weather code or fertilizer label is missing/invalid.'})
  if weather in ['W1','W2'] and fert is None:blank_fertilizer_rows.append(i)
  continue
 fertilizer=fert.strip()
 key=(weather,block,rep,fertilizer)
 groups[(weather,fertilizer)].append((i,r))
 identities[key].append({'excelRow':i,'freshweightCobG':r[9] if isinstance(r[9],(int,float)) else None,'freshweightCobSpathG':r[8] if isinstance(r[8],(int,float)) else None,'numberCob':r[4] if isinstance(r[4],(int,float)) else None})
for (weather,fert),rs in sorted(groups.items()):
 vals=[r[9] for _,r in rs if isinstance(r[9],(int,float))]
 summary['groups'].append({'weather':weather,'fertilizer':fert,'rows':len(rs),'freshCobWeightNumericN':len(vals),'freshCobWeightMissingN':len(rs)-len(vals),'rawRecordMeanFreshCobG':mean(vals) if vals else None,'interpretation':'Unadjusted record description only; not an inferential treatment estimate.'})
summary['repeatedCompositeKeys']=[{'key':list(k),'rows':len(items),'sourceRows':[item['excelRow'] for item in items],'measurementsDiffer':len({(item['freshweightCobG'],item['freshweightCobSpathG'],item['numberCob']) for item in items})>1,'records':items} for k,items in identities.items() if len(items)>1]
nonempty=[r for r in rows if any(v is not None for v in r)]
target=[r[9] for r in nonempty]
summary['yieldSheetAudit']={
 'nonEmptyRows':len(nonempty),
 'validTreatmentRows':sum(len(v) for v in groups.values()),
 'numericFreshweightCobN':sum(isinstance(v,(int,float)) for v in target),
 'missingFreshweightCobN':sum(v is None for v in target),
 'literalDotN':sum(v=='.' for v in target),
 'uniqueCompleteCompositeKeys':len(identities),
 'singleRecordCompleteCompositeKeys':sum(len(v)==1 for v in identities.values()),
 'repeatedCompositeKeys':sum(len(v)>1 for v in identities.values()),
 'extraRowsWithinRepeatedCompositeKeys':sum(len(v)-1 for v in identities.values() if len(v)>1),
 'rowsMissingFertilizerLabel':blank_fertilizer_rows,
 'repeatedCompositeKeysRetainedWithoutDeduplication':True
}
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
 p=folder/name
 entry={'file':name,'url':url,'license':license}
 if p.is_file():
  b=p.read_bytes();entry.update({'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'md5':hashlib.md5(b).hexdigest(),'acquiredOn':'2026-11-10','status':'downloaded and read'})
 else:
  entry.update({'bytes':None,'sha256':None,'md5':None,'acquiredOn':None,'status':'file is not present in the current checkout; acquisition and checksum were not re-verified'})
 manifest.append(entry)
(folder/'sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
