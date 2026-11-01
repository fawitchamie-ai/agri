import unittest,tempfile,json,sqlite3,sys,csv,hashlib,zlib,base64
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/calibration'))
from build import Builder,number,valid_date
from acquire import ckan_resource_public,acquire_one
from refresh_context import ofra_bytes,install_snapshot,geojson_features,canonical_wosis
from audit_campaign import audit_export,decode
from xlsx_reader import Workbook
from evidence import generate

@unittest.skipUnless(all((ROOT/s['path']).is_file() for s in json.loads((ROOT/'research-data/calibration/manifest.json').read_text())['files'] if '/research-only/' in s['path']), 'NC-SA originals not redistributed: explicitly acquire under their licence to run real research tests')
class ExperimentalBase(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();cls.output=Path(cls.temp.name)/'research'
  cls.builder=Builder(cls.output,True);cls.report=cls.builder.build();cls.db=sqlite3.connect(cls.output/'experimental.sqlite');cls.db.row_factory=sqlite3.Row
 @classmethod
 def tearDownClass(cls):cls.db.close();cls.temp.cleanup()
 def scalar(self,sql,args=()):return self.db.execute(sql,args).fetchone()[0]
 def test_actual_design_and_country_scope(self):
  self.assertEqual(self.scalar('SELECT count(*) FROM campaigns'),4420)
  self.assertEqual(self.scalar('SELECT count(*) FROM blocks'),8)
  self.assertEqual(self.scalar('SELECT count(*) FROM plots'),117)
  self.assertEqual(self.scalar("SELECT count(*) FROM observation_units WHERE country='CIV' AND crop='maize'"),2400)
  self.assertEqual(self.scalar("SELECT count(*) FROM observation_units WHERE country='SEN'"),588)
  self.assertEqual(self.report['pilot_cohort'],{'plot_seasons':576,'first_year':1971,'last_year':1976,'plots':96})
  self.assertEqual(self.report['calibrated_countries'],[])
  self.assertEqual(self.scalar("SELECT count(*) FROM qc_issues WHERE code='UNRECOGNIZED_CROP'"),8)
  self.assertEqual(self.scalar('SELECT count(*) FROM response_functions'),534)
  self.assertEqual(self.scalar('SELECT count(*) FROM context_observations'),112)
 def test_tonnes_kg_and_unresolved_sown_denominator(self):
  r=self.db.execute("SELECT h.*,p.experimental_area_m2 FROM harvests h JOIN campaigns c ON c.id=h.campaign_id JOIN plots p ON p.id=c.plot_id WHERE c.year=1971 AND c.season='First' AND p.source_label='C0N0:1'").fetchone()
  self.assertAlmostEqual(r['yield_value'],4.39);self.assertAlmostEqual(r['yield_kg_ha'],4390)
  self.assertEqual(r['moisture_percent'],15);self.assertEqual(r['experimental_area_m2'],43.2)
  self.assertIn('unspecified',r['denominator']);self.assertIsNone(r['mass_kg']);self.assertIsNone(r['area_m2'])
 def test_annual_n_not_double_counted_and_compost_actual_not_nominal(self):
  self.assertEqual(self.scalar("SELECT count(*) FROM interventions WHERE unit='kg N/ha/year'"),1920)
  self.assertEqual(self.scalar("SELECT count(*) FROM interventions WHERE unit='kg N/ha/year' AND campaign_id IS NOT NULL"),0)
  r=self.db.execute("SELECT i.dose,i.composition_id FROM interventions i JOIN campaigns c ON c.id=i.campaign_id JOIN plots p ON p.id=c.plot_id WHERE p.source_label='C1N0:1' AND c.year=1971 AND c.season='First'").fetchone()
  self.assertEqual(r['dose'],2700);self.assertIsNone(r['composition_id'])
  self.assertGreater(self.scalar("SELECT count(*) FROM qc_issues WHERE code='COMPOST_PERIOD_PROTOCOL_CONFLICT'"),0)
  self.assertIn('common PK',self.db.execute("SELECT control_definition FROM treatments WHERE source_label='C0N0'").fetchone()[0])
 def test_soil_methods_depths_no_backward_fill(self):
  self.assertEqual(self.scalar("SELECT count(*) FROM soil_profiles WHERE site_id='cirad-gagnoa:site' AND (upper_cm<>0 OR lower_cm<>20)"),0)
  self.assertEqual(self.scalar("SELECT count(*) FROM soil_profiles WHERE site_id='cirad-gagnoa:site' AND year=1993 AND plot_id IS NOT NULL"),0)
  self.assertEqual(self.scalar("SELECT count(*) FROM campaign_soil_links l JOIN soil_profiles p ON p.id=l.profile_id WHERE p.year=1993"),0)
  self.assertEqual(self.scalar('SELECT count(*) FROM campaign_soil_links WHERE predictor_eligible=1'),0)
  row=self.db.execute("SELECT analytical_method,unit FROM soil_measurements WHERE parameter='N_NH4' AND value IS NOT NULL LIMIT 1").fetchone()
  self.assertIn('1M KCl',row['analytical_method']);self.assertEqual(row['unit'],'mg/kg dry soil')
  row=self.db.execute("SELECT analytical_method,unit FROM soil_measurements WHERE parameter='K_exch' AND value IS NOT NULL LIMIT 1").fetchone()
  self.assertIn('ammonium acetate',row['analytical_method']);self.assertIn('cmol(+)',row['unit'])
  self.assertEqual(self.scalar("SELECT count(*) FROM soil_profiles WHERE site_id LIKE 'wosis:%'"),4977)
  self.assertEqual(self.scalar("SELECT count(*) FROM soil_profiles WHERE site_id LIKE 'wosis:%' AND licence LIKE '%NonCommercial%'"),0)
 def test_cropped_beds_not_64m2_and_no_six_fake_replicates(self):
  r=self.db.execute("SELECT h.* FROM harvests h JOIN campaigns c ON c.id=h.campaign_id JOIN plots p ON p.id=c.plot_id WHERE p.source_label='D100_1' AND c.season='C2:tomato'").fetchone()
  self.assertAlmostEqual(r['mass_kg'],127.759);self.assertAlmostEqual(r['yield_kg_ha'],26616.458333333332)
  self.assertEqual(r['area_m2'],48);self.assertIn('not_gross_64',r['denominator'])
  self.assertEqual(self.scalar("SELECT count(*) FROM campaigns c JOIN crop_varieties v ON v.id=c.variety_id WHERE v.crop='lettuce'"),210)
  self.assertEqual(self.scalar("SELECT count(*) FROM qc_issues WHERE code='RECONSTRUCTED_BED_SUBSAMPLES'"),63)
  self.assertEqual(self.scalar("SELECT count(*) FROM harvests WHERE status='incomplete_no_extrapolation'"),12)
 def test_fresh_product_not_dry_matter_and_missing_never_zero(self):
  r=self.db.execute("SELECT i.dose,i.unit,i.date FROM interventions i JOIN campaigns c ON c.id=i.campaign_id JOIN plots p ON p.id=c.plot_id WHERE p.source_label='SS100_1' AND c.season='C1:lettuce' AND i.kind='organic_fertilizer'").fetchone()
  self.assertEqual(r['dose'],5400);self.assertIn('fresh',r['unit']);self.assertEqual(r['date'],'2016-02-27')
  self.assertIsNone(number('NA'));self.assertEqual(number(0),0);self.assertIsNone(number(float('inf')))
 def test_export_lineage_and_integrity(self):
  self.assertEqual(self.db.execute('PRAGMA integrity_check').fetchone()[0],'ok');self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
  with (self.output/'tables/harvests.csv').open() as f:self.assertEqual(len(list(csv.DictReader(f))),4420)
  self.assertIn('NON COMMERCIAL',(self.output/'LICENCE.txt').read_text())
  with self.assertRaisesRegex(ValueError,'already exists'):Builder(self.output,True)
 def test_published_metadata_rebuild_and_stale_audit_guard(self):
  destination=Path(self.temp.name)/'evidence'
  result=generate(self.output/'experimental.sqlite',self.output/'quality.json',destination)
  self.assertEqual(result,json.loads((ROOT/'docs/calibration/EVIDENCE.json').read_text()))
  report=json.loads((self.output/'quality.json').read_text());report['input_fingerprints']['manifest_sha256']='0'*64
  changed=Path(self.temp.name)/'stale-quality.json';changed.write_text(json.dumps(report))
  with self.assertRaisesRegex(ValueError,'Stale audit'):generate(self.output/'experimental.sqlite',changed,destination)
 def test_leakage_and_synthetic_validation_are_rejected(self):
  m=sqlite3.connect(':memory:');self.db.backup(m);m.row_factory=sqlite3.Row
  b=object.__new__(Builder);b.db=m
  ids=[r[0] for r in m.execute("SELECT id FROM campaigns WHERE dependency_group='cirad-gagnoa:site' LIMIT 2")]
  m.execute('INSERT INTO split_assignments VALUES(?,?,?)',(ids[0],'train','test fixture'))
  m.execute('INSERT INTO split_assignments VALUES(?,?,?)',(ids[1],'test','test fixture'))
  with self.assertRaisesRegex(ValueError,'leakage'):b.check()
  m.execute('DELETE FROM split_assignments');m.execute('UPDATE campaigns SET synthetic=1 WHERE id=?',(ids[0],));m.execute('INSERT INTO split_assignments VALUES(?,?,?)',(ids[0],'test','synthetic fixture'))
  with self.assertRaisesRegex(ValueError,'Synthetic'):b.check()
  m.close()
 def test_dates_are_not_backfilled_and_months_are_not_daily(self):
  self.assertEqual(valid_date('1997-9-1'),'1997-09-01');self.assertIsNone(valid_date('1997-?-?'));self.assertIsNone(valid_date('1997-02-30'))
  self.assertGreater(self.scalar("SELECT count(*) FROM soil_profiles p JOIN source_rows r ON r.id=p.source_row_id WHERE p.site_id LIKE 'wosis:%' AND p.year=1985 AND p.sampled_on IS NULL AND r.raw_json LIKE '%1985-??-??%'"),0)
  self.assertEqual(self.scalar("SELECT count(*) FROM weather_series WHERE time_step='month'"),2)
  self.assertGreater(self.scalar('SELECT count(*) FROM weather_observations WHERE value IS NULL'),0)
  self.assertEqual(self.scalar("SELECT count(*) FROM campaign_soil_links l JOIN campaigns c ON c.id=l.campaign_id JOIN soil_profiles p ON p.id=l.profile_id WHERE p.sampled_on IS NOT NULL AND c.sowing_date IS NOT NULL AND p.sampled_on>=c.sowing_date"),0)
  self.assertGreater(self.scalar("SELECT count(*) FROM qc_issues WHERE code='MANAGEMENT_MISSING'"),0,'lettuce C10 source year conflict is not silently corrected')
 def test_open_rebuild_contains_no_nc_experiments(self):
  out=Path(self.temp.name)/'open';report=Builder(out).build()
  self.assertEqual(report['table_counts']['campaigns'],0);self.assertEqual(report['table_counts']['source_files'],3)
  self.assertEqual(report['table_counts']['response_functions'],534)
  self.assertNotIn('CC-BY-NC-SA',json.dumps(report['files']))
 def test_checksum_guard_and_embargo_guard(self):
  f=lambda i,v:{'properties':{'profile_id':i,'layer_id':i,'value_avg':v}}
  a={'type':'FeatureCollection','features':[f(2,5.4),f(1,6.2)]};b={**a,'features':list(reversed(a['features']))}
  self.assertEqual(canonical_wosis(a)[0],canonical_wosis(b)[0])
  self.assertNotEqual(canonical_wosis(a)[0],canonical_wosis({**a,'features':[f(2,5.5),f(1,6.2)]})[0])
  point={'type':'FeatureCollection','features':[{'geometry':{'type':'Point','coordinates':[1.2,9.5]}}]}
  self.assertEqual(len(geojson_features(point,'TGO')),1)
  with self.assertRaisesRegex(ValueError,'reference system'):geojson_features({**point,'crs':{'type':'name','properties':{'name':'EPSG:3857'}}},'TGO')
  with self.assertRaisesRegex(ValueError,'axis swap'):geojson_features({'type':'FeatureCollection','features':[{'geometry':{'type':'Point','coordinates':[9.5,1.2]}}]},'TGO')
  out=Path(self.temp.name)/'tamper';b=Builder(out)
  spec=dict(b.manifest['files'][-1]);spec['sha256']='0'*64
  with self.assertRaisesRegex(ValueError,'Checksum'):b.read_file(spec)
  b.db.close();b.path.unlink()
  self.assertFalse(ckan_resource_public({'isopen':True,'embargo_end_date':'2027-12-01'},{'restricted':'{"level":"public"}'},'2026-11-01')[0])
  self.assertFalse(ckan_resource_public({'isopen':True},{'restricted':'{"level":"only_allowed_users"}'},'2026-11-01')[0])
  self.assertTrue(ckan_resource_public({'embargo_end_date':'2018-07-03'},{'restricted':''},'2026-11-01')[0])
  with patch('urllib.request.urlopen',side_effect=AssertionError('must not fetch')):
   self.assertIn('opt_in',acquire_one({'license':'CC-BY-NC-SA-4.0','path':'private.xlsx'},Path(self.temp.name),False)['status'])
 def test_merged_metadata_never_fills_measurement_blanks(self):
  w=Workbook(ROOT/'research-data/calibration/raw/research-only/1_DATA_SOIL_SOERE-PRO_SENEGAL.xlsx');md=w.metadata_dictionary()
  self.assertEqual(md['N_NH4']['explicit_merged_unit'],'D17:D18');self.assertEqual(md['K_exch']['explicit_merged_method'],'C24:C27');w.close()
 def test_private_campaign_simulation_is_not_a_yield_label(self):
  c={'config':{'country':'TGO','cropProfile':{'id':'maize'},'yieldEstimation':{'units':[{'reference':{'kgHa':99999}}]},'weather':[{'status':'forecast'}]},'plan':{'yieldEstimation':{'productionKg':999999}},'events':[{'kind':'irrigation','status':'planned'},{'kind':'irrigation','status':'declared'}]}
  a=audit_export(c);self.assertFalse(a['plan_is_a_harvest_label']);self.assertFalse(a['yield_reference_is_a_harvest_label']);self.assertEqual(a['irrigation_recorded'],1);self.assertEqual(a['irrigation_planned'],1);self.assertFalse(a['public_corpus_imported'])
  compressor=zlib.compressobj(wbits=-15);b=compressor.compress(json.dumps(c['config']).encode())+compressor.flush();packed=json.dumps({'encoding':'agri-deflate-json-1','data':base64.b64encode(b).decode()});self.assertEqual(decode(packed),c['config'])

class OpenDelivery(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();cls.report=Builder(Path(cls.temp.name)/'open').build();cls.db=sqlite3.connect(Path(cls.temp.name)/'open/experimental.sqlite')
 @classmethod
 def tearDownClass(cls):cls.db.close();cls.temp.cleanup()
 def test_actual_open_files_and_no_experimental_labels(self):
  self.assertEqual(self.report['table_counts']['source_files'],3);self.assertEqual(self.report['table_counts']['campaigns'],0);self.assertEqual(self.report['table_counts']['harvests'],0)
  self.assertEqual(self.report['table_counts']['response_functions'],534);self.assertEqual(self.report['table_counts']['context_observations'],112)
 def test_open_country_profile_coverage_and_licences(self):
  counts=dict(self.db.execute("SELECT s.country,count(*) FROM soil_profiles p JOIN sites s ON s.id=p.site_id GROUP BY s.country"))
  self.assertEqual(counts,{'TGO':38,'BEN':2824,'BFA':49,'GHA':1224,'CIV':142,'SEN':700})
  self.assertEqual(self.db.execute("SELECT count(*) FROM soil_profiles WHERE licence LIKE '%NonCommercial%'").fetchone()[0],0)
 def test_open_provenance_and_no_nearest_point_trial_joins(self):
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
  self.assertEqual(self.db.execute('SELECT count(*) FROM campaign_soil_links').fetchone()[0],0)
  self.assertEqual(self.db.execute('SELECT count(*) FROM soil_measurements WHERE analytical_method IS NULL').fetchone()[0],0)
 def test_published_audit_fingerprints_match_repository(self):
  q=json.loads((ROOT/'docs/calibration/CONTROLES_IMPORT.json').read_text())
  for key,path in {'manifest_sha256':'research-data/calibration/manifest.json','registry_sha256':'docs/calibration/REGISTRE_SOURCES.json','schema_sha256':'research-data/calibration/schema.sql','importer_sha256':'scripts/calibration/build.py','xlsx_reader_sha256':'scripts/calibration/xlsx_reader.py'}.items():self.assertEqual(q['input_fingerprints'][key],hashlib.sha256((ROOT/path).read_bytes()).hexdigest())
  self.assertEqual(q['calibrated_countries'],[]);self.assertFalse(q['validation_split_assigned'])
 def test_resource_restriction_and_opt_in_before_any_download(self):
  self.assertFalse(ckan_resource_public({'isopen':True,'embargo_end_date':'2027-12-01'},{},'2026-11-01')[0])
  self.assertFalse(ckan_resource_public({'isopen':True},{'restricted':'{"level":"only_allowed_users"}'},'2026-11-01')[0])
  with patch('urllib.request.urlopen',side_effect=AssertionError('must not fetch')):self.assertIn('opt_in',acquire_one({'license':'CC-BY-NC-SA-4.0','path':'local.xlsx'},Path(self.temp.name),False)['status'])
 def test_wfs_order_not_value_canonicalization(self):
  f=lambda i,v:{'properties':{'profile_id':i,'layer_id':i,'value_avg':v}}
  a={'features':[f(2,5.4),f(1,6.2)]};self.assertEqual(canonical_wosis(a)[0],canonical_wosis({'features':list(reversed(a['features']))})[0]);self.assertNotEqual(canonical_wosis(a)[0],canonical_wosis({'features':[f(2,5.5),f(1,6.2)]})[0])

if __name__=='__main__':unittest.main()
