'use client';
import { useMemo, useState } from 'react';
import { COUNTRIES, type CampaignSummary } from '../../lib/seasonal/types';
import { HelpParagraph } from './help-dialog';
import './campaign-library.css';

type Command = 'rename' | 'archive' | 'restore';
type Props = {
  campaigns: CampaignSummary[];
  loading: boolean;
  error: string;
  truncated?: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onNew: () => void;
  onManage: (campaign: CampaignSummary, command: Command, name?: string) => Promise<boolean>;
  onRetry: () => void;
  onImport: () => void;
  onRestoreDraft: () => void;
};

const hectares = (areaM2?: number | null) => areaM2 == null || !Number.isFinite(areaM2)
  ? 'Surface à préciser'
  : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(areaM2 / 10000)} ha`;
const shortDate = (value?: string | null) => {
  if (!value) return 'Date de semis à préciser';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.valueOf()) ? 'Date de semis à préciser' : `Semis · ${parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};
const updatedDate = (value?: string) => {
  if (!value) return 'Mise à jour non renseignée';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? 'Mise à jour non renseignée' : `Modifiée le ${parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

export default function CampaignLibrary({ campaigns, loading, error, truncated, busy, onOpen, onDuplicate, onNew, onManage, onRetry, onImport, onRestoreDraft }: Props) {
  const [scope, setScope] = useState<'active' | 'archived'>('active');
  const [query, setQuery] = useState('');
  const [crop, setCrop] = useState('');
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState<'updated' | 'name' | 'sowing'>('updated');
  const [editingId, setEditingId] = useState('');
  const [draftName, setDraftName] = useState('');

  const active = campaigns.filter(c => !c.archivedAt);
  const archived = campaigns.filter(c => !!c.archivedAt);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr');
    return campaigns.filter(c => (scope === 'archived' ? !!c.archivedAt : !c.archivedAt)
      && (!crop || c.crop === crop)
      && (!country || c.country === country)
      && (!normalized || [c.name, c.territory, c.crop, COUNTRIES[c.country]?.name].some(v => String(v || '').toLocaleLowerCase('fr').includes(normalized))))
      .sort((a, b) => sort === 'name'
        ? a.name.localeCompare(b.name, 'fr')
        : sort === 'sowing'
          ? String(b.sowingDate || '').localeCompare(String(a.sowingDate || ''))
          : String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [campaigns, country, crop, query, scope, sort]);
  const crops = [...new Set(campaigns.map(c => c.crop).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const countries = [...new Set(campaigns.map(c => c.country).filter(Boolean))];

  function renderCampaignCard(campaign: CampaignSummary) {
    return (
      <article className={'campaign-record'+(campaign.archivedAt ? ' is-archived' : '')} key={campaign.id}>
        <div className="campaign-record-topline"><span className="campaign-record-country">{COUNTRIES[campaign.country]?.name || campaign.country}</span><span className={'campaign-record-state'+(campaign.archivedAt ? ' archived' : '')}>{campaign.archivedAt ? 'Archivée' : 'Active'}</span></div>
        {editingId === campaign.id ? <form className="campaign-rename-form" onSubmit={e => { e.preventDefault(); void rename(campaign); }}>
          <label className="field"><span>Nouveau nom</span><input autoFocus value={draftName} maxLength={120} onChange={e => setDraftName(e.target.value)} required/></label>
          <div><button className="btn primary small" disabled={busy || !draftName.trim()}>Enregistrer</button><button className="btn secondary small" type="button" onClick={() => setEditingId('')}>Annuler</button></div>
        </form> : <>
          <button className="campaign-record-open" onClick={() => !campaign.archivedAt && onOpen(campaign.id)} disabled={!!campaign.archivedAt || busy}>
            <strong>{campaign.name || 'Campagne sans nom'}</strong>
            <span>{campaign.crop || 'Culture à préciser'}{campaign.territory ? ` · ${campaign.territory}` : ''}</span>
            <span className="campaign-record-details">{shortDate(campaign.sowingDate)}<i>·</i>{hectares(campaign.areaM2)}</span>
          </button>
          <div className="campaign-record-meta"><span>Révision {campaign.revision}</span><span>{updatedDate(campaign.updatedAt)}</span></div>
          <div className="campaign-record-actions">
            {!campaign.archivedAt && <>
              <button className="btn primary small" onClick={() => onOpen(campaign.id)} disabled={busy}>Ouvrir la campagne</button>
              <button className="btn secondary small" onClick={() => { setEditingId(campaign.id); setDraftName(campaign.name); }}>Renommer</button>
              <button className="btn secondary small" onClick={() => onDuplicate(campaign.id)} disabled={busy} title="Reprendre le contour et les réglages, sans copier les récoltes ni les interventions réalisées">Réutiliser les réglages</button>
            </>}
            <a className="btn secondary small" href={`/api/seasonal?id=${encodeURIComponent(campaign.id)}&revision=${campaign.revision}`}>Exporter la révision</a>
            <button className="btn secondary small" onClick={() => void toggleArchive(campaign)} disabled={busy}>{campaign.archivedAt ? 'Restaurer' : 'Archiver'}</button>
          </div>
        </>}
      </article>
    );
  }

  const campaignContent = loading
    ? <div className="campaign-library-empty" role="status">Chargement de vos campagnes…</div>
    : visible.length
      ? <div className="campaign-library-grid">{visible.map(renderCampaignCard)}</div>
      : <div className="campaign-library-empty"><strong>{scope === 'archived' ? 'Aucune campagne archivée.' : campaigns.length ? 'Aucune campagne ne correspond à ces filtres.' : 'Votre espace campagne est prêt.'}</strong><HelpParagraph>{scope === 'archived' ? 'Les campagnes archivées resteront disponibles ici et peuvent être restaurées.' : campaigns.length ? 'Modifiez la recherche ou les filtres, ou effacez-les pour revoir toutes les campagnes.' : 'Créez une campagne depuis un contour de champ, puis enregistrez-la pour la retrouver ici.'}</HelpParagraph>{!campaigns.length && <button className="btn primary" onClick={onNew}>Créer ma première campagne</button>}</div>;

  async function rename(campaign: CampaignSummary) {
    const name = draftName.trim();
    if (!name || name === campaign.name) { setEditingId(''); return; }
    if (await onManage(campaign, 'rename', name)) setEditingId('');
  }

  async function toggleArchive(campaign: CampaignSummary) {
    if (campaign.archivedAt) {
      await onManage(campaign, 'restore');
      return;
    }
    const confirm = window.confirm(`Archiver « ${campaign.name} » ? Elle disparaîtra de la liste active, mais son historique et ses données resteront conservés.`);
    if (confirm) await onManage(campaign, 'archive');
  }

  return <section className="campaign-library-manager" aria-labelledby="campaign-library-title">
    <div className="campaign-library-heading">
      <div>
        <span className="product-eyebrow">VOTRE HISTORIQUE AGRICOLE</span>
        <h2 id="campaign-library-title">Mes campagnes</h2>
        <HelpParagraph>Retrouvez vos champs, reprenez une simulation, renommez une campagne ou archivez celles que vous avez terminées.</HelpParagraph>
      </div>
      <div className="campaign-library-primary-actions">
        <button className="btn secondary" onClick={onImport}>Importer une campagne</button>
        <button className="btn primary" onClick={onNew}>Nouvelle campagne</button>
      </div>
    </div>

    <div className="campaign-library-stats" aria-label="Résumé des campagnes">
      <div><strong>{active.length}</strong><span>Campagnes actives</span></div>
      <div><strong>{archived.length}</strong><span>Campagnes archivées</span></div>
      <div><strong>{new Set(active.map(c => c.country)).size}</strong><span>Pays représentés</span></div>
    </div>

    <div className="campaign-library-switch" role="tablist" aria-label="État des campagnes">
      <button role="tab" aria-selected={scope === 'active'} onClick={() => setScope('active')}>Actives <b>{active.length}</b></button>
      <button role="tab" aria-selected={scope === 'archived'} onClick={() => setScope('archived')}>Archivées <b>{archived.length}</b></button>
    </div>

    <div className="campaign-library-filters">
      <label className="field"><span>Rechercher</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom du champ, culture ou localité" type="search"/></label>
      <label className="field"><span>Culture</span><select value={crop} onChange={e => setCrop(e.target.value)}><option value="">Toutes les cultures</option>{crops.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
      <label className="field"><span>Pays</span><select value={country} onChange={e => setCountry(e.target.value)}><option value="">Tous les pays</option>{countries.map(c => <option key={c} value={c}>{COUNTRIES[c as keyof typeof COUNTRIES]?.name || c}</option>)}</select></label>
      <label className="field"><span>Trier par</span><select value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="updated">Dernière modification</option><option value="sowing">Date de semis</option><option value="name">Nom du champ</option></select></label>
    </div>

    {error && <div className="notice warning" role="alert"><div><strong>La liste ne peut pas être actualisée.</strong><HelpParagraph>{error}</HelpParagraph><button className="btn secondary small" onClick={onRetry} disabled={busy}>Réessayer</button></div></div>}
    {campaignContent}
    {truncated && <p className="campaign-library-limit">La liste présente les 500 campagnes les plus récentes de cet espace.</p>}
    <div className="campaign-library-utilities"><button className="qs-text-button" onClick={onRestoreDraft}>Restaurer le brouillon de cet appareil</button></div>
  </section>;
}
