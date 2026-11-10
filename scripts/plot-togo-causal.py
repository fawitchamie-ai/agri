"""Publication-style diagnostic plots; source observations are not daily digitizations."""
import json,gzip,pathlib,datetime
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
p=pathlib.Path('research-data/togo-causal/2026-11-10')
r=json.load(gzip.open(p/'rue-daily.json.gz'));a=json.load(open(p/'aquacrop-summary.json'))
colors={'FI':'#173E70','80':'#3875FF','60':'#D99500'}
fig,ax=plt.subplots(2,2,figsize=(12,8),layout='constrained');fig.suptitle('Essai togolais : le plafond K masque la réponse hydrique',fontsize=17,fontweight='bold')
for t,color in colors.items():
 x=next(x for x in r['records'] if x['experiment']=='A-original' and x['calendar']=='daily' and x['treatment']==t);d=[datetime.date.fromisoformat(q['date']) for q in x['days']]
 ax[0,0].plot(d,[q['waterFactor'] for q in x['days']],label=t+' %' if t!='FI' else 'FI',color=color,lw=1.8)
 ax[0,1].plot(d,[q['stockKgHa'][2] for q in x['days']],color=color,lw=1.7,ls={'FI':'-','80':'--','60':':' }[t])
 for exp,style in [('A-original','-'),('B-nutrition-unlimited','--')]:
  y=next(q for q in r['records'] if q['experiment']==exp and q['calendar']=='daily' and q['treatment']==t)
  ax[1,0].plot(d,[q['biomassKgHa']/1000 for q in y['days']],color=color,ls=style,lw=1.7)
ax[0,0].axvline(datetime.date(2018,2,3),color='#666666',ls=':',lw=1);ax[0,0].set(title='Facteur hydrique journalier (RUE)',ylabel='Fraction de la croissance sans déficit',ylim=(0,1.05));ax[0,0].legend(frameon=False)
ax[0,1].set(title='Stock K accessible hypothétique',ylabel='kg K/ha');ax[0,1].text(.02,.82,'K limitant à partir du 3 février\n3 courbes superposées',transform=ax[0,1].transAxes,fontsize=10)
ax[1,0].set(title='Biomasse du moteur RUE',ylabel='Biomasse sèche (t/ha)');ax[1,0].text(.02,.82,'Trait plein : nutrition illustrative\nTirets : nutrition non limitante\nAucune courbe n’est une mesure',transform=ax[1,0].transAxes,fontsize=9)
labels=['Observé','RUE original','RUE sans\nlimite nutritive','AquaCrop-OSPy\nsans fertilité'];vals80=[r['observedRatios']['Y80_YFI'],1,next(x for x in r['contrasts'] if x['experiment']=='B-nutrition-unlimited' and x['calendar']=='daily' and x['treatment']=='80')['ratioVsFI'],next(x for x in a['contrasts'] if x['calendar']=='daily')['ratios']['80']];vals60=[r['observedRatios']['Y60_YFI'],1,next(x for x in r['contrasts'] if x['experiment']=='B-nutrition-unlimited' and x['calendar']=='daily' and x['treatment']=='60')['ratioVsFI'],next(x for x in a['contrasts'] if x['calendar']=='daily')['ratios']['60']]
xx=list(range(4));ax[1,1].bar([v-.17 for v in xx],vals80,width=.32,color=colors['80'],label='Y80 / YFI');ax[1,1].bar([v+.17 for v in xx],vals60,width=.32,color=colors['60'],label='Y60 / YFI');ax[1,1].set_xticks(xx,labels,fontsize=9);ax[1,1].set(title='Réponse relative aux traitements',ylabel='Rapport au traitement FI',ylim=(0,1.15));ax[1,1].legend(frameon=False,fontsize=9)
for axis in ax.flat:
 axis.spines[['top','right']].set_visible(False);axis.grid(axis='y',alpha=.18);axis.set_axisbelow(True)
for axis in [ax[0,0],ax[0,1],ax[1,0]]:
 axis.tick_params(axis='x',rotation=20,labelsize=8)
fig.text(.5,-.025,'Scénarios exploratoires. Trois moyennes d’un même essai ; aucune calibration ou validation indépendante.',ha='center',fontsize=9)
fig.savefig(p/'causal-water-nutrients.png',dpi=170,bbox_inches='tight');plt.close(fig)
