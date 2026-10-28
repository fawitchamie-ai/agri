"""Raw-source panel with explicit area semantics and administrative uncertainty."""
from pathlib import Path
import argparse,hashlib,json,unicodedata,re
import numpy as np
import pandas as pd
PRODUCTS_H={'Maize':'Maize','Sorghum':'Sorghum','Rice':'Rice','Millet':'Millet','Soybean':'Soybean','Cowpea':'Cowpea'}
PRODUCTS_F={'Maize (Corn)':'Maize','Sorghum':'Sorghum','Rice (Paddy)':'Rice','Millet':'Millet','Soybean (unspecified)':'Soybean','Cowpea (unspecified)':'Cowpea'}
KEY=['crop','prefecture_modele_35','harvest_year']
JOIN=['datasourcedocument','fnid','product','season_year','crop_production_system','publication_name','start_date','period_date']
def norm(v):
 return re.sub(r'\s+',' ',''.join(c for c in unicodedata.normalize('NFKD',str(v).strip().lower()) if not unicodedata.combining(c))).replace('’',"'")
def build(raw,out):
 raw=Path(raw);out=Path(out);out.mkdir(parents=True,exist_ok=True)
 hf=raw/'hvstat_africa_data_v1.2.csv';ff=raw/'root/crop_data.csv'
 geo=json.loads((raw/'exports/geodata/togo_prefectures_modele_35.geojson').read_text())
 props=pd.DataFrame([f['properties'] for f in geo['features']])
 assert props.admin_2.nunique()==35 and not props.fnid.duplicated().any()
 canonical={norm(x):x for x in props.admin_2};assert len(canonical)==35
 h=pd.read_csv(hf,low_memory=False);h['raw_row_number']=h.index+2
 h=h[h.country.eq('Togo')&h['product'].isin(PRODUCTS_H)].copy()
 h['crop']=h['product'].map(PRODUCTS_H);h['region']=h.admin_1
 h['prefecture_modele_35']=h.admin_2.map(lambda v:canonical.get(norm(v)))
 h['yield_t_ha']=pd.to_numeric(h['yield'],errors='coerce');h['production_t']=pd.to_numeric(h.production,errors='coerce')
 h['area_reported_ha']=pd.to_numeric(h.area,errors='coerce');h['area_planted_ha']=np.nan;h['area_harvested_ha']=np.nan
 h['area_semantics']='cropped_area_reported_harvested_vs_planted_unresolved'
 h['source_id']='HarvestStat_v1.2';h['raw_file']=hf.name
 h['raw_record_id']=h.fnid.astype(str)+'|'+h['product'].astype(str)+'|'+h.harvest_year.astype(str)+'|'+h.season_name.astype(str)
 h['original_document']='HarvestStat compilation; underlying FEWS/official record unresolved'
 h['observation_kind']='harmonized_official_statistic_not_independent_measurement'
 h['source_family']='FEWS_HARVESTSTAT_related';h['unit_yield']='t/ha'
 h['source_unit_yield']='t/ha (HarvestStat documented schema)'
 h['geography_status']=np.where(h.fnid.isin(props.fnid),'SAME_HARVESTSTAT_UNIT_ID','UNRESOLVED_GEOGRAPHY')
 h['quality_issue']=np.where(h.qc_flag.ne(0),'source_qc_flag',np.where(~np.isfinite(h.yield_t_ha)|h.yield_t_ha.le(0),'invalid_yield',np.where(~np.isfinite(h.area_reported_ha)|h.area_reported_ha.le(0),'invalid_reported_area','')))
 h['ratio_area_basis']='area_reported_ha'
 h['ratio_residual_t_ha']=h.yield_t_ha-h.production_t/h.area_reported_ha
 h.loc[h.quality_issue.eq('')&h.ratio_residual_t_ha.abs().gt(5e-4),'quality_issue']='production_area_yield_inconsistent'
 f=pd.read_csv(ff,low_memory=False);f['raw_row_number']=f.index+2
 f=f[f.country.eq('Togo')&f['product'].isin(PRODUCTS_F)&f.admin_2.notna()].copy()
 if f.duplicated(JOIN+['indicator']).any():raise ValueError('Duplicate exact FEWS indicator keys: resolve source, never average')
 yields=f[f.indicator.eq('Yield')].copy()
 for ind,col,unit in [('Quantity Produced','production_t','Tonne'),('Area Planted','area_planted_ha','hectare'),('Area Harvested','area_harvested_ha','hectare')]:
  other=f[f.indicator.eq(ind)][JOIN+['value','unit_name','id']].copy()
  if other.unit_name.ne(unit).any():raise ValueError('Unexpected FEWS source unit: '+ind)
  other=other.drop(columns='unit_name').rename(columns={'value':col,'id':col+'_raw_id'})
  yields=yields.merge(other,on=JOIN,how='left',validate='one_to_one')
 f=yields;f['crop']=f['product'].map(PRODUCTS_F);f['region']=f.admin_1
 f['prefecture_modele_35']=f.admin_2.map(lambda v:canonical.get(norm(v)))
 f['harvest_year']=pd.to_numeric(f.season_year.str.extract(r'(\d{4})')[0],errors='coerce')
 f['yield_t_ha']=pd.to_numeric(f.value,errors='coerce');f['area_reported_ha']=np.nan
 f['source_id']='FEWS_FDW_crop_data';f['raw_file']=ff.name;f['raw_record_id']=f.id.astype(str)
 f['original_document']=f.source_document.astype(str)+' | '+f.publication_name.astype(str)
 f['observation_kind']='published_official_statistic_crop_final';f['source_family']='FEWS_HARVESTSTAT_related'
 f['area_semantics']='planted_available_harvested_unavailable';f['source_unit_yield']=f.unit_name
 f['unit_yield']=np.where(f.unit_name.eq('tonnes per hectare'),'t/ha',None)
 f['geography_status']=np.where(f.fnid.isin(props.fnid),'SAME_HARVESTSTAT_UNIT_ID','NAME_LINK_ONLY_BOUNDARY_UNVERIFIED')
 f['quality_issue']=np.where(f.unit_name.ne('tonnes per hectare'),'yield_unit_unexpected',np.where(~np.isfinite(f.yield_t_ha)|f.yield_t_ha.le(0),'invalid_yield',''))
 f['ratio_area_basis']='area_planted_ha';f['ratio_residual_t_ha']=f.yield_t_ha-f.production_t/f.area_planted_ha
 f.loc[f.quality_issue.eq('')&f.ratio_residual_t_ha.abs().gt(5e-4),'quality_issue']='production_planted_area_yield_inconsistent'
 f.loc[f.prefecture_modele_35.isna(),'quality_issue']='no_verified_35_unit_correspondence'
 split=f.admin_2.map(norm).isin(['sotouboua','mo'])&~f.fnid.isin(props.fnid)
 f.loc[split,'quality_issue']='administrative_split_requires_spatial_reaggregation'
 f.to_csv(out/'fews_linked_indicators.csv',index=False)
 cols=KEY+['region','yield_t_ha','production_t','area_reported_ha','area_harvested_ha','area_planted_ha','area_semantics','source_id','source_family','raw_file','raw_row_number','raw_record_id','original_document','observation_kind','unit_yield','source_unit_yield','fnid','admin_2','season_name','crop_production_system','geography_status','quality_issue','ratio_area_basis','ratio_residual_t_ha']
 d=pd.concat([h[cols],f[cols]],ignore_index=True)
 shas={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [hf,ff]};d['raw_file_sha256']=d.raw_file.map(shas)
 d['geography_vintage_code']=d.fnid.astype(str).str.extract(r'^[A-Z]{2}(\d{4})')[0]
 d['selected']=False;d['exclusion_reason']=d.quality_issue
 preferred=(d.harvest_year.le(2015)&d.source_id.eq('HarvestStat_v1.2'))|(d.harvest_year.gt(2015)&d.source_id.eq('FEWS_FDW_crop_data'))
 d.loc[d.quality_issue.eq('')&~preferred,'exclusion_reason']='related_source_not_preferred_for_year'
 d.loc[d[KEY].isna().any(axis=1),'exclusion_reason']='missing_or_unmapped_key'
 candidates=d[d.exclusion_reason.eq('')].copy();dup=candidates.duplicated(KEY,keep=False)
 d.loc[candidates.index[dup],'exclusion_reason']='duplicate_candidate_key'
 z=d[d.exclusion_reason.eq('')].sort_values(KEY).copy();d.loc[z.index,'selected']=True;z['selected']=True
 z['harvest_year']=z.harvest_year.astype(int)
 assert not z.duplicated(KEY).any() and np.isfinite(z.yield_t_ha).all()
 d.to_csv(out/'source_candidates.csv',index=False);z.to_csv(out/'canonical_panel.csv',index=False)
 d.groupby(['source_id','exclusion_reason','selected'],dropna=False).size().rename('rows').reset_index().to_csv(out/'source_exclusions.csv',index=False)
 d[['fnid','admin_2','prefecture_modele_35','region','geography_vintage_code','geography_status','exclusion_reason']].drop_duplicates().to_csv(out/'administrative_correspondence_audit.csv',index=False)
 meta={'selected_rows':len(z),'source_shas':shas,'crops':z.groupby('crop').agg(rows=('yield_t_ha','size'),first_year=('harvest_year','min'),last_year=('harvest_year','max'),prefectures=('prefecture_modele_35','nunique')).to_dict('index'),'area_note':'HV area semantics unresolved; FEWS yield related to planted area, not harvested area','boundary_note':'post2015 FNID links are diagnostic until geometry verified; no fabricated crosswalk'}
 (out/'panel_manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2));print(json.dumps(meta,ensure_ascii=False))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--raw',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();build(a.raw,a.out)