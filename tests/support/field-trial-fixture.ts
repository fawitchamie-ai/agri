import {exampleCampaign} from '../../lib/seasonal/example.ts';
import {applyCropProfile} from '../../lib/seasonal/catalog.ts';
import {geometryIdentity} from '../../lib/seasonal/provenance.ts';
import {createTrialLayout,type FieldTrial} from '../../lib/seasonal/field-trials.ts';
import {testParcel} from './land-fixtures.mjs';
/** Synthetic software fixture, never experimental evidence. */
export function fixture(){
 const c=applyCropProfile(exampleCampaign('2026-11-02'),'maize');c.parcelGeometry=testParcel;
 const trial:FieldTrial={version:'field-trial-1',id:'trial-1',geometryId:geometryIdentity(testParcel),cropId:'maize',createdOn:c.asOfDate,question:'Software fixture only',protocol:'Synthetic protocol, no real field trial',buffers:'Synthetic buffers',agronomicReview:null,assignment:'randomized',seed:42,arms:{control:'Without studied complement',alternative:'With studied complement'},plots:createTrialLayout(2,false,42)};
 c.fieldTrials=[trial];return c;
}
