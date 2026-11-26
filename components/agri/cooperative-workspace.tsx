'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { COUNTRIES } from '../../lib/seasonal/types';
import type { Bootstrap, BusinessRecord, CooperativeProfile } from '../../lib/contracts';
import { HelpParagraph } from './help-dialog';
import './cooperative-workspace.css';

type Tab = 'overview' | 'profile' | 'members' | 'resources' | 'access';
type Account = { id: string; name: string; role: string; createdAt: string; memberId: string | null; memberName: string | null };
type Invitation = { id: string; role: string; memberId: string | null; email: string | null; createdBy: string; expiresAt: string; acceptedAt: string | null };
type MemberDraft = { name: string; locality: string; phone: string; email: string; memberNumber: string; active: boolean };
type CapacityDraft = { point: string; storage: string; transport: string; pumpFlowM3h: string; pumpDays: number[]; pumpStartHHmm: string; pumpEndHHmm: string };
const blankProfile = (coopId = ''): CooperativeProfile => ({ coopId, name: 'Ma coopérative', country: 'TGO', region: '', locality: '', phone: '', email: '', contactName: '' });
const blankMember = (): MemberDraft => ({ name: '', locality: '', phone: '', email: '', memberNumber: '', active: true });
const blankCapacity = (): CapacityDraft => ({ point: '', storage: '', transport: '', pumpFlowM3h: '', pumpDays: [], pumpStartHHmm: '', pumpEndHHmm: '' });
const weekdayNames=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const formatNumber = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
const formatDate = (value?: string | null) => {
  if (!value) return 'Non renseignée';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? 'Non renseignée' : parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};
const roleName: Record<string, string> = { responsable: 'Responsable', admin: 'Administrateur', agent: 'Agent agricole', producteur: 'Producteur' };
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

async function request<T = any>(path: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  const response = await fetch(path, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  let data: any;
  try { data = await response.json(); } catch { throw new Error('Le service ne répond pas. Réessayez ; vos données restent enregistrées.'); }
  if (!response.ok) throw new Error(data.error || 'Impossible de terminer cette action.');
  return data as T;
}

export default function CooperativeWorkspace({ workspace, records, onRefresh }: { workspace: Bootstrap | null; records: BusinessRecord[]; onRefresh: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [profile, setProfile] = useState<CooperativeProfile>(blankProfile(workspace?.session.coopId));
  const [profileLoading, setProfileLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState('');
  const [memberDraft, setMemberDraft] = useState<MemberDraft>(blankMember());
  const [memberQuery, setMemberQuery] = useState('');
  const [memberScope, setMemberScope] = useState<'active' | 'inactive'>('active');
  const [capacityFormOpen, setCapacityFormOpen] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState('');
  const [capacityDraft, setCapacityDraft] = useState<CapacityDraft>(blankCapacity());
  const [inviteRole, setInviteRole] = useState<'agent' | 'producteur'>('agent');
  const [inviteMemberId, setInviteMemberId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [newInviteCode, setNewInviteCode] = useState('');
  const [demoRole, setDemoRole] = useState<Bootstrap['session']['role']>(workspace?.session.role ?? 'responsable');
  const [demoCoop, setDemoCoop] = useState(workspace?.session.coopId.includes('demo-b') ? 'demo-b' : 'demo-a');

  const canManage = !!workspace && ['responsable', 'admin'].includes(workspace.session.role);
  const demo = !!workspace?.session.demo;
  const allMembers = records.filter(record => record.kind === 'member');
  const capacities = records.filter(record => record.kind === 'capacity');
  const harvests = records.filter(record => record.kind === 'harvest');
  const collections = records.filter(record => record.kind === 'collection');
  const activeMembers = allMembers.filter(record => record.data.active !== false);
  const inactiveMembers = allMembers.filter(record => record.data.active === false);
  const memberMap = new Map(allMembers.map(record => [record.id, record.data.name]));
  const filteredMembers = useMemo(() => allMembers
    .filter(member => memberScope === 'inactive' ? member.data.active === false : member.data.active !== false)
    .filter(member => !memberQuery.trim() || [member.data.name, member.data.locality, member.data.phone, member.data.email, member.data.memberNumber].some(value => String(value || '').toLocaleLowerCase('fr').includes(memberQuery.trim().toLocaleLowerCase('fr'))))
    .sort((a, b) => String(a.data.name).localeCompare(String(b.data.name), 'fr')),
  [allMembers, memberQuery, memberScope]);
  const storage = capacities.reduce((sum, record) => sum + (Number(record.data.storage) || 0), 0);
  const transport = capacities.reduce((sum, record) => sum + (Number(record.data.transport) || 0), 0);
  const pendingInvitations = invitations.filter(invite => !invite.acceptedAt && new Date(invite.expiresAt).valueOf() > Date.now());

  useEffect(() => {
    if (!workspace) { setProfile(blankProfile()); return; }
    let alive = true;
    const coopId = workspace.session.coopId;
    setProfileLoading(true);
    request<{ profile: CooperativeProfile }>('/api/cooperative')
      .then(result => { if (alive && result.profile.coopId === coopId) setProfile(result.profile); })
      .catch(e => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setProfileLoading(false); });
    return () => { alive = false; };
  }, [workspace?.session.coopId]);

  useEffect(() => {
    let alive = true;
    setAccessLoaded(false);
    setAccounts([]);
    setInvitations([]);
    if (!canManage || demo) { setMembersLoading(false); setAccessLoaded(true); return () => { alive = false; }; }
    setMembersLoading(true);
    request<{ accounts: Account[]; invitations: Invitation[] }>('/api/access')
      .then(result => { if (alive) { setAccounts(result.accounts); setInvitations(result.invitations); setAccessLoaded(true); } })
      .catch(e => { if (alive) { setError((e as Error).message); setAccessLoaded(true); } })
      .finally(() => { if (alive) setMembersLoading(false); });
    return () => { alive = false; };
  }, [workspace?.session.coopId, workspace?.session.role, demo, canManage]);

  function flash(message: string) { setNotice(message); setError(''); }
  async function reloadAccess() {
    if (!canManage || demo) return;
    const result = await request<{ accounts: Account[]; invitations: Invitation[] }>('/api/access');
    setAccounts(result.accounts); setInvitations(result.invitations); setAccessLoaded(true);
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await request<{ profile: CooperativeProfile }>('/api/cooperative', { action: 'save', profile });
      setProfile(result.profile); flash('Informations de la coopérative enregistrées.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function saveMember(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const previous = records.find(record => record.id === editingMember);
    try {
      await request('/api/workspace', { kind: 'member', id: editingMember || undefined, updatedAt: previous?.updatedAt, data: memberDraft });
      await onRefresh(); setMemberFormOpen(false); setEditingMember(''); setMemberDraft(blankMember());
      flash(editingMember ? 'Fiche du membre mise à jour.' : 'Membre ajouté à la coopérative.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function editMember(member: BusinessRecord) {
    setMemberDraft({ name: member.data.name || '', locality: member.data.locality || '', phone: member.data.phone || '', email: member.data.email || '', memberNumber: member.data.memberNumber || '', active: member.data.active !== false });
    setEditingMember(member.id); setMemberFormOpen(true); setTab('members');
  }
  async function archiveMember(member: BusinessRecord) {
    const nextActive = member.data.active === false;
    if (!nextActive && !window.confirm(`Archiver la fiche de ${member.data.name} ? Ses récoltes et collectes resteront conservées et la fiche pourra être réactivée.`)) return;
    setBusy(true); setError('');
    try {
      await request('/api/workspace', { kind: 'member', id: member.id, updatedAt: member.updatedAt, data: { ...member.data, active: nextActive } });
      await onRefresh(); flash(nextActive ? 'Membre réactivé.' : 'Membre archivé. Ses récoltes et collectes restent conservées.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function saveCapacity(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const previous = records.find(record => record.id === editingCapacity);
    try {
      await request('/api/workspace', { kind: 'capacity', id: editingCapacity || undefined, updatedAt: previous?.updatedAt, data: { point: capacityDraft.point, storage: Number(capacityDraft.storage), transport: Number(capacityDraft.transport), pumpFlowM3h: capacityDraft.pumpFlowM3h===''?null:Number(capacityDraft.pumpFlowM3h), pumpDays:capacityDraft.pumpFlowM3h===''?[]:capacityDraft.pumpDays, pumpStartHHmm:capacityDraft.pumpFlowM3h===''?'':capacityDraft.pumpStartHHmm, pumpEndHHmm:capacityDraft.pumpFlowM3h===''?'':capacityDraft.pumpEndHHmm } });
      await onRefresh(); setCapacityDraft(blankCapacity()); setCapacityFormOpen(false); setEditingCapacity('');
      flash(editingCapacity ? 'Moyen de la coopérative mis à jour.' : 'Moyen de la coopérative ajouté.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function deleteCapacity(capacity: BusinessRecord) {
    if (!window.confirm(`Retirer le point « ${capacity.data.point} » ?`)) return;
    setBusy(true); setError('');
    try {
      await request('/api/workspace', { id: capacity.id, confirm: true }, 'DELETE'); await onRefresh();
      flash('Point de stockage retiré.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function createInvitation(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNewInviteCode('');
    try {
      const result = await request<{ code: string }>('/api/access', { action: 'create', role: inviteRole, memberId: inviteRole === 'producteur' ? inviteMemberId : undefined, email: inviteEmail || undefined });
      setNewInviteCode(result.code); setInviteEmail(''); setInviteMemberId(''); await reloadAccess();
      flash('Invitation créée. Copiez le code et transmettez-le à la personne concernée.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function revokeInvitation(invite: Invitation) {
    if (!window.confirm('Révoquer ce code ? La personne ne pourra plus l’utiliser.')) return;
    setBusy(true); setError('');
    try { await request('/api/access', { action: 'revoke', id: invite.id }); await reloadAccess(); flash('Invitation révoquée.'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function acceptInvitation() {
    if (!inviteCode.trim()) return;
    setBusy(true); setError('');
    try {
      await request('/api/access', { action: 'accept', code: inviteCode.trim() });
      setInviteCode(''); await onRefresh(); flash('Invitation acceptée. La coopérative a été ajoutée à vos espaces. Vos campagnes précédentes restent disponibles dans « Espace actif ».');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function openDemo() {
    setBusy(true); setError('');
    try { await request('/api/demo', { role: demoRole, coopId: demoCoop }); await onRefresh(); flash('Espace de démonstration ouvert. Les membres et les activités sont fictifs.'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function signOutDemo() {
    setBusy(true); setError('');
    try { await request('/api/demo', {}, 'DELETE'); await onRefresh(); flash('Espace de démonstration fermé.'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(newInviteCode); flash('Code copié dans le presse-papiers.'); }
    catch { setError('La copie automatique est indisponible. Sélectionnez le code et copiez-le manuellement.'); }
  }
  function exportMembers() {
    const headers = ['Numéro', 'Nom', 'Localité', 'Téléphone', 'Email', 'État'];
    const rows = allMembers.map(member => [member.data.memberNumber, member.data.name, member.data.locality, member.data.phone, member.data.email, member.data.active === false ? 'Archivé' : 'Actif']);
    const csv = '\ufeff' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'membres-cooperative.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!workspace) return <section className="coop-management" aria-labelledby="coop-workspace-title">
    <header className="coop-management-heading"><div className="coop-management-mark" aria-hidden="true">C</div><div className="coop-management-title"><span className="product-eyebrow">VOTRE ESPACE COLLECTIF</span><h2 id="coop-workspace-title">Rejoindre une coopérative</h2><p>Ouvrez une démonstration ou acceptez un code reçu d’un responsable.</p></div></header>
    {notice && <div className="notice info" role="status">{notice}</div>}{error && <div className="notice warning" role="alert">{error}</div>}
    <section className="card"><span className="eyebrow">INVITATION D’ÉQUIPE</span><h3>Accepter un code d’invitation</h3><HelpParagraph>Connectez-vous avec le compte auquel le code est destiné. Si vos données se trouvent dans un autre espace, elles y seront conservées.</HelpParagraph><label className="field"><span>Code reçu du responsable</span><input autoComplete="off" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Collez le code reçu"/></label><div className="form-actions"><button className="btn primary" disabled={busy || !inviteCode.trim()} onClick={() => void acceptInvitation()}>Accepter l’invitation</button></div></section>
  </section>;

  return <section className="coop-management" aria-labelledby="coop-workspace-title">
    <header className="coop-management-heading">
      <div className="coop-management-mark" aria-hidden="true">{(profile.name || 'C').trim().slice(0, 1).toLocaleUpperCase('fr')}</div>
      <div className="coop-management-title">
        <span className="product-eyebrow">VOTRE ESPACE COLLECTIF</span>
        <h2 id="coop-workspace-title">{profileLoading ? 'Chargement de la coopérative…' : profile.name}</h2>
        <p>{profile.locality || profile.region || COUNTRIES[profile.country as keyof typeof COUNTRIES]?.name || 'Informations de la coopérative'}</p>
      </div>
      <span className="coop-role-badge">{workspace ? roleName[workspace.session.role] || workspace.session.role : 'Non connecté'}</span>
      {demo && <span className="coop-demo-badge">Démonstration</span>}
    </header>

    {notice && <div className="notice info" role="status">{notice}</div>}
    {error && <div className="notice warning" role="alert">{error}</div>}

    <div className="coop-management-tabs" role="tablist" aria-label="Gestion de la coopérative">
      {([['overview', 'Vue d’ensemble'], ['profile', 'Informations'], ['members', 'Membres'], ['resources', 'Moyens'], ['access', 'Accès']] as [Tab, string][]).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
    </div>

    {tab === 'overview' && <>
      <div className="coop-summary-grid">
        <article><span>Membres actifs</span><strong>{activeMembers.length}</strong><small>{inactiveMembers.length} archivé(s), historique conservé</small></article>
        <article><span>Récoltes enregistrées</span><strong>{harvests.length}</strong><small>{harvests.filter(h => h.data.status === 'valide').length} validée(s) par la coopérative</small></article>
        <article><span>Collectes planifiées</span><strong>{collections.filter(c => c.data.status !== 'annule').length}</strong><small>Quantités tenues séparées des récoltes</small></article>
        <article><span>Stockage renseigné</span><strong>{capacities.length ? `${formatNumber(storage)} t` : '—'}</strong><small>{capacities.length ? `${formatNumber(transport)} t par créneau` : 'Aucune capacité déclarée'}</small></article>
      </div>
      <div className="coop-overview-grid">
        <section className="card"><div className="card-header"><div><span className="eyebrow">FICHE DE LA STRUCTURE</span><h3>Informations principales</h3></div><button className="btn secondary small" onClick={() => setTab('profile')}>Modifier la fiche</button></div>
          {profile.configured ? <dl className="coop-profile-summary"><dt>Pays</dt><dd>{COUNTRIES[profile.country as keyof typeof COUNTRIES]?.name || profile.country}</dd><dt>Région</dt><dd>{profile.region || 'Non renseignée'}</dd><dt>Localité</dt><dd>{profile.locality || 'Non renseignée'}</dd><dt>Responsable</dt><dd>{profile.contactName || 'Non renseigné'}</dd><dt>Téléphone</dt><dd>{profile.phone || 'Non renseigné'}</dd><dt>Email</dt><dd>{profile.email || 'Non renseignée'}</dd></dl> : <HelpParagraph>Complétez le profil de la coopérative pour que vos membres et vos campagnes partagent une fiche claire.</HelpParagraph>}
        </section>
        <section className="card"><div className="card-header"><div><span className="eyebrow">À FAIRE</span><h3>Accéder rapidement</h3></div></div>
          <div className="coop-shortcuts"><button onClick={() => { setTab('members'); setMemberFormOpen(true); }}><span><strong>Ajouter un membre</strong><small>Créer ou mettre à jour une fiche de producteur</small></span><b>Gérer</b></button><button onClick={() => setTab('access')}><span><strong>Inviter dans l’équipe</strong><small>Créer un code d’accès nominatif</small></span><b>Ouvrir</b></button><button onClick={() => { setTab('resources'); setCapacityFormOpen(true); }}><span><strong>Renseigner les moyens</strong><small>Stockage et transport par point</small></span><b>Gérer</b></button></div>
        </section>
      </div>
    </>}

    {tab === 'profile' && <section className="card coop-profile-editor"><div className="card-header"><div><span className="eyebrow">IDENTITÉ ET CONTACT</span><h3>Fiche de la coopérative</h3><HelpParagraph>Ces informations décrivent votre espace et facilitent le suivi des campagnes et de l’équipe.</HelpParagraph></div></div>
      <form onSubmit={saveProfile}><div className="form-grid">
        <label className="field"><span>Nom de la coopérative</span><input required disabled={!canManage || demo} maxLength={120} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} placeholder="Ex. Coopérative des producteurs de Kara"/></label>
        <label className="field"><span>Pays</span><select disabled={!canManage || demo} value={profile.country} onChange={e => setProfile({ ...profile, country: e.target.value })}>{Object.entries(COUNTRIES).map(([code, value]) => <option key={code} value={code}>{value.name}</option>)}</select></label>
        <label className="field"><span>Région</span><input disabled={!canManage || demo} maxLength={120} value={profile.region} onChange={e => setProfile({ ...profile, region: e.target.value })} placeholder="Ex. Kara"/></label>
        <label className="field"><span>Commune ou localité</span><input disabled={!canManage || demo} maxLength={160} value={profile.locality} onChange={e => setProfile({ ...profile, locality: e.target.value })} placeholder="Ex. Kozah 1"/></label>
        <label className="field"><span>Nom du responsable</span><input disabled={!canManage || demo} maxLength={120} value={profile.contactName} onChange={e => setProfile({ ...profile, contactName: e.target.value })}/></label>
        <label className="field"><span>Téléphone</span><input disabled={!canManage || demo} type="tel" maxLength={32} value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+228 …"/></label>
        <label className="field"><span>Email de contact</span><input disabled={!canManage || demo} type="email" maxLength={200} value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}/></label>
      </div><div className="form-actions"><button className="btn primary" disabled={busy || !canManage || demo}>{busy ? 'Enregistrement…' : 'Enregistrer les informations'}</button></div></form>
      {(!canManage || demo) && <HelpParagraph className="source-note">La modification de la fiche est réservée au responsable de la coopérative. Les espaces de démonstration ne modifient pas de données réelles.</HelpParagraph>}
    </section>}

    {tab === 'members' && <>
      <section className="coop-member-toolbar"><div><span className="eyebrow">ANNUAIRE COMMUNAUTAIRE</span><h3>Membres et producteurs</h3><p>{activeMembers.length} membre(s) actif(s) · {inactiveMembers.length} fiche(s) archivée(s)</p></div><div><button className="btn secondary" onClick={exportMembers} disabled={!allMembers.length}>Exporter la liste</button><button className="btn primary" onClick={() => { setMemberDraft(blankMember()); setEditingMember(''); setMemberFormOpen(!memberFormOpen); }}>{memberFormOpen ? 'Fermer le formulaire' : 'Ajouter un membre'}</button></div></section>
      {memberFormOpen && <section className="card"><div className="card-header"><div><span className="eyebrow">{editingMember ? 'MODIFIER UNE FICHE' : 'NOUVELLE FICHE'}</span><h3>{editingMember ? 'Mettre à jour le membre' : 'Ajouter un membre'}</h3></div></div>
        <form onSubmit={saveMember}><div className="form-grid">
          <label className="field"><span>Nom complet</span><input required maxLength={120} value={memberDraft.name} onChange={e => setMemberDraft({ ...memberDraft, name: e.target.value })} placeholder="Nom et prénoms"/></label>
          <label className="field"><span>Village ou localité</span><input required maxLength={160} value={memberDraft.locality} onChange={e => setMemberDraft({ ...memberDraft, locality: e.target.value })}/></label>
          <label className="field"><span>Téléphone</span><input type="tel" maxLength={32} value={memberDraft.phone} onChange={e => setMemberDraft({ ...memberDraft, phone: e.target.value })} placeholder="+228 …"/></label>
          <label className="field"><span>Email (facultatif)</span><input type="email" maxLength={200} value={memberDraft.email} onChange={e => setMemberDraft({ ...memberDraft, email: e.target.value })}/></label>
          <label className="field"><span>Numéro membre (facultatif)</span><input maxLength={40} value={memberDraft.memberNumber} onChange={e => setMemberDraft({ ...memberDraft, memberNumber: e.target.value })} placeholder="Code interne de la coopérative"/></label>
          {editingMember && <label className="field"><span>État du membre</span><select value={memberDraft.active ? 'active' : 'inactive'} onChange={e => setMemberDraft({ ...memberDraft, active: e.target.value === 'active' })}><option value="active">Actif</option><option value="inactive">Archivé</option></select></label>}
        </div><div className="form-actions"><button className="btn primary" disabled={busy || !canManage}>{busy ? 'Enregistrement…' : editingMember ? 'Enregistrer les changements' : 'Ajouter le membre'}</button><button className="btn secondary" type="button" onClick={() => { setMemberFormOpen(false); setEditingMember(''); }}>Annuler</button></div></form>
        {!canManage && <HelpParagraph className="source-note">Seul le responsable ou l’administrateur peut gérer les fiches des membres.</HelpParagraph>}
      </section>}
      <section className="card"><div className="coop-member-list-heading"><label className="field"><span>Rechercher un membre</span><input type="search" value={memberQuery} onChange={e => setMemberQuery(e.target.value)} placeholder="Nom, localité, numéro ou téléphone"/></label><div className="coop-member-scope" role="tablist" aria-label="État des membres"><button role="tab" aria-selected={memberScope === 'active'} onClick={() => setMemberScope('active')}>Actifs · {activeMembers.length}</button><button role="tab" aria-selected={memberScope === 'inactive'} onClick={() => setMemberScope('inactive')}>Archivés · {inactiveMembers.length}</button></div></div>
        {filteredMembers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Membre</th><th>Localité</th><th>Contact</th><th>Activité communautaire</th><th>État</th><th>Actions</th></tr></thead><tbody>{filteredMembers.map(member => {
          const harvestCount = harvests.filter(h => h.data.memberId === member.id).length;
          const collectionCount = collections.filter(c => c.data.memberId === member.id).length;
          const owner = accounts.find(account => account.memberId === member.id);
          return <tr key={member.id}><td><strong>{member.data.name}</strong>{member.data.memberNumber && <small className="coop-table-subline">N° {member.data.memberNumber}</small>}{owner && <small className="coop-table-subline">Compte lié · {roleName[owner.role] || owner.role}</small>}</td><td>{member.data.locality || '—'}</td><td>{member.data.phone || member.data.email || '—'}{member.data.phone && member.data.email && <small className="coop-table-subline">{member.data.email}</small>}</td><td>{harvestCount} récolte(s)<small className="coop-table-subline">{collectionCount} collecte(s)</small></td><td><span className={'coop-state-pill'+(member.data.active === false ? ' inactive' : '')}>{member.data.active === false ? 'Archivé' : 'Actif'}</span></td><td><div className="coop-row-actions"><button className="btn secondary small" disabled={!canManage} onClick={() => editMember(member)}>Modifier</button><button className="btn secondary small" disabled={!canManage || busy} onClick={() => void archiveMember(member)}>{member.data.active === false ? 'Réactiver' : 'Archiver'}</button></div></td></tr>;
        })}</tbody></table></div> : <div className="coop-empty"><strong>{memberQuery ? 'Aucun membre ne correspond à la recherche.' : memberScope === 'inactive' ? 'Aucun membre archivé.' : 'Aucun membre enregistré.'}</strong><HelpParagraph>Les fiches archivées restent disponibles et conservent le lien vers les récoltes et collectes déjà saisies.</HelpParagraph></div>}
      </section>
    </>}

    {tab === 'resources' && <>
      <section className="coop-member-toolbar"><div><span className="eyebrow">INFRASTRUCTURES</span><h3>Stockage, transport et pompes</h3><p>Déclarez les capacités et horaires réellement disponibles. Les valeurs restent vides tant qu’elles ne sont pas renseignées.</p></div><button className="btn primary" disabled={!canManage || demo} onClick={() => { setCapacityDraft(blankCapacity()); setEditingCapacity(''); setCapacityFormOpen(!capacityFormOpen); }}>{capacityFormOpen ? 'Fermer le formulaire' : 'Ajouter un moyen'}</button></section>
      {capacityFormOpen && <section className="card"><div className="card-header"><div><span className="eyebrow">{editingCapacity ? 'MODIFIER UN MOYEN' : 'NOUVEAU MOYEN'}</span><h3>{editingCapacity ? 'Mettre à jour les capacités' : 'Déclarer stockage, transport ou pompe'}</h3></div></div>
        <form onSubmit={saveCapacity}><div className="form-grid"><label className="field"><span>Nom du point ou du matériel</span><input required maxLength={160} value={capacityDraft.point} onChange={e => setCapacityDraft({ ...capacityDraft, point: e.target.value })}/></label><label className="field"><span>Stockage disponible (t)</span><input required type="number" min="0" step="any" value={capacityDraft.storage} onChange={e => setCapacityDraft({ ...capacityDraft, storage: e.target.value })}/></label><label className="field"><span>Transport par créneau (t)</span><input required type="number" min="0" step="any" value={capacityDraft.transport} onChange={e => setCapacityDraft({ ...capacityDraft, transport: e.target.value })}/></label><label className="field"><span>Débit de la pompe partagée (m³/h, facultatif)</span><input type="number" min="0.001" max="1000000" step="any" value={capacityDraft.pumpFlowM3h} onChange={e => setCapacityDraft({ ...capacityDraft, pumpFlowM3h: e.target.value })} placeholder="Non renseigné"/></label>
          {capacityDraft.pumpFlowM3h!==''&&<><fieldset className="field"><legend>Jours disponibles</legend><div className="form-actions">{weekdayNames.map((day,index)=><label key={day}><input type="checkbox" checked={capacityDraft.pumpDays.includes(index)} onChange={e=>setCapacityDraft({...capacityDraft,pumpDays:e.target.checked?[...capacityDraft.pumpDays,index]:capacityDraft.pumpDays.filter(value=>value!==index)})}/>{day}</label>)}</div></fieldset><label className="field"><span>Début de disponibilité</span><input required type="time" value={capacityDraft.pumpStartHHmm} onChange={e=>setCapacityDraft({...capacityDraft,pumpStartHHmm:e.target.value})}/></label><label className="field"><span>Fin de disponibilité</span><input required type="time" value={capacityDraft.pumpEndHHmm} onChange={e=>setCapacityDraft({...capacityDraft,pumpEndHHmm:e.target.value})}/></label></>}
        </div><div className="form-actions"><button className="btn primary" disabled={busy || !canManage || demo}>{editingCapacity ? 'Enregistrer les changements' : 'Ajouter ce moyen'}</button><button className="btn secondary" type="button" onClick={() => { setCapacityFormOpen(false); setEditingCapacity(''); }}>Annuler</button></div></form><HelpParagraph>Un créneau de pompe est calculé à partir du bilan d’eau enregistré de la campagne. Aucun débit ni horaire n’est prérempli.</HelpParagraph></section>}
      <section className="coop-capacity-grid">{capacities.length ? capacities.map(capacity => <article className="card" key={capacity.id}><div className="coop-capacity-title"><span className="coop-capacity-icon">⌂</span><div><h3>{capacity.data.point}</h3><p>Capacité renseignée par la coopérative</p></div></div><dl className="coop-capacity-values"><dt>Stockage disponible</dt><dd>{formatNumber(Number(capacity.data.storage) || 0)} t</dd><dt>Transport par créneau</dt><dd>{formatNumber(Number(capacity.data.transport) || 0)} t</dd>{Number(capacity.data.pumpFlowM3h)>0&&<><dt>Débit de pompe</dt><dd>{formatNumber(Number(capacity.data.pumpFlowM3h))} m³/h</dd><dt>Disponibilité</dt><dd>{(capacity.data.pumpDays||[]).map((day:number)=>weekdayNames[day]).join(', ')} · {capacity.data.pumpStartHHmm}–{capacity.data.pumpEndHHmm}</dd></>}</dl><div className="coop-row-actions"><button className="btn secondary small" disabled={!canManage || demo} onClick={() => { setCapacityDraft({ point: capacity.data.point || '', storage: String(capacity.data.storage ?? ''), transport: String(capacity.data.transport ?? ''), pumpFlowM3h:capacity.data.pumpFlowM3h==null?'':String(capacity.data.pumpFlowM3h), pumpDays:capacity.data.pumpDays||[], pumpStartHHmm:capacity.data.pumpStartHHmm||'', pumpEndHHmm:capacity.data.pumpEndHHmm||'' }); setEditingCapacity(capacity.id); setCapacityFormOpen(true); }}>Modifier</button><button className="btn secondary small" disabled={!canManage || busy || demo} onClick={() => void deleteCapacity(capacity)}>Retirer</button></div></article>) : <div className="coop-empty"><strong>Aucun moyen renseigné.</strong><HelpParagraph>Ajoutez un point de stockage, de transport ou une pompe réellement disponible.</HelpParagraph></div>}</section>
    </>}

    {tab === 'access' && <div className="coop-access-grid">
      <section className="card"><span className="eyebrow">REJOINDRE UN ESPACE</span><h3>Accepter une invitation</h3><HelpParagraph>Collez le code reçu du responsable. Si vous changez de coopérative, les données de votre ancien espace restent conservées dans cet espace.</HelpParagraph><label className="field"><span>Code d’invitation</span><input autoComplete="off" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Collez le code reçu"/></label><div className="form-actions"><button className="btn primary" disabled={busy || !inviteCode.trim()} onClick={() => void acceptInvitation()}>Accepter l’invitation</button></div></section>
      {canManage && !demo && <section className="card"><span className="eyebrow">ÉQUIPE ET AUTORISATIONS</span><h3>Inviter un membre de l’équipe</h3><HelpParagraph>Le code est lié à cette coopérative et expire après sept jours. Vous le transmettez vous-même ; aucun email n’est envoyé.</HelpParagraph><form onSubmit={createInvitation}><div className="form-grid"><label className="field"><span>Rôle</span><select value={inviteRole} onChange={e => setInviteRole(e.target.value as typeof inviteRole)}><option value="agent">Agent agricole</option><option value="producteur">Producteur</option></select></label><label className="field"><span>Email de la personne (facultatif)</span><input type="email" maxLength={200} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}/></label>{inviteRole === 'producteur' && <label className="field"><span>Fiche du producteur à rattacher</span><select required value={inviteMemberId} onChange={e => setInviteMemberId(e.target.value)}><option value="">Choisir une fiche active</option>{activeMembers.map(member => <option key={member.id} value={member.id}>{member.data.name} · {member.data.locality}</option>)}</select></label>}</div><div className="form-actions"><button className="btn primary" disabled={busy || (inviteRole === 'producteur' && !inviteMemberId)}>Créer le code</button></div></form>
        {newInviteCode && <div className="coop-invite-code"><label className="field"><span>Code à transmettre</span><input readOnly value={newInviteCode} onFocus={e => e.currentTarget.select()}/></label><button className="btn secondary" onClick={() => void copyInvite()}>Copier le code</button></div>}
      </section>}
      {demo && <section className="card"><span className="eyebrow">ENVIRONNEMENT FICTIF</span><h3>Votre espace de démonstration</h3><HelpParagraph>Les membres et activités de cet espace sont fictifs. Les invitations vers des comptes réels sont désactivées. Vous pouvez changer de rôle pour consulter les droits de chaque profil.</HelpParagraph><div className="form-grid"><label className="field"><span>Rôle de démonstration</span><select value={demoRole} onChange={e => setDemoRole(e.target.value as Bootstrap['session']['role'])}><option value="responsable">Responsable</option><option value="agent">Agent agricole</option><option value="producteur">Producteur</option><option value="admin">Administrateur</option></select></label><label className="field"><span>Coopérative fictive</span><select value={demoCoop} onChange={e => setDemoCoop(e.target.value)}><option value="demo-a">Coopérative A</option><option value="demo-b">Coopérative B</option></select></label></div><div className="form-actions"><button className="btn secondary" disabled={busy} onClick={() => void openDemo()}>Changer d’espace de démonstration</button><button className="btn secondary" disabled={busy} onClick={() => void signOutDemo()}>Fermer la démonstration</button></div></section>}
      {canManage && !demo && <section className="card coop-team-card"><div className="card-header"><div><span className="eyebrow">COMPTES DE LA COOPÉRATIVE</span><h3>Équipe et invitations</h3><HelpParagraph>{accounts.length} compte(s) associé(s) · {pendingInvitations.length} invitation(s) en attente</HelpParagraph></div></div>
        {!accessLoaded || membersLoading ? <div className="coop-empty" role="status">Chargement de l’équipe…</div> : <>
          {accounts.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Compte</th><th>Rôle</th><th>Fiche producteur liée</th><th>Accès depuis</th></tr></thead><tbody>{accounts.map(account => <tr key={account.id}><td><strong>{account.name}</strong>{account.id === workspace?.session.userId && <small className="coop-table-subline">Vous</small>}</td><td>{roleName[account.role] || account.role}</td><td>{account.memberName || 'Aucune'}</td><td>{formatDate(account.createdAt)}</td></tr>)}</tbody></table></div> : <div className="coop-empty"><strong>Aucun compte invité pour le moment.</strong><HelpParagraph>Créez un code pour donner accès à un agent ou à un producteur.</HelpParagraph></div>}
          <h4 className="coop-invitation-heading">Codes d’invitation</h4>
          {invitations.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Destinataire</th><th>Rôle</th><th>Fiche membre</th><th>État</th><th>Expire le</th><th></th></tr></thead><tbody>{invitations.map(invite => {
            const status = invite.acceptedAt ? 'Acceptée' : new Date(invite.expiresAt).valueOf() <= Date.now() ? 'Expirée' : 'En attente';
            return <tr key={invite.id}><td>{invite.email || 'Code non nominatif'}</td><td>{roleName[invite.role] || invite.role}</td><td>{invite.memberId ? memberMap.get(invite.memberId) || 'Fiche indisponible' : '—'}</td><td><span className={'coop-state-pill'+(status !== 'En attente' ? ' inactive' : '')}>{status}</span></td><td>{formatDate(invite.expiresAt)}</td><td>{status === 'En attente' && <button className="btn secondary small" disabled={busy} onClick={() => void revokeInvitation(invite)}>Révoquer</button>}</td></tr>;
          })}</tbody></table></div> : <HelpParagraph>Aucune invitation créée pour cette coopérative.</HelpParagraph>}
        </>}
      </section>}
      {workspace && !canManage && <section className="card"><span className="eyebrow">VOTRE ACCÈS</span><h3>{roleName[workspace.session.role] || workspace.session.role}</h3><HelpParagraph>Les modifications de la coopérative, de ses membres et de ses autorisations sont réservées à son responsable. Vous pouvez accepter un autre code d’invitation ici.</HelpParagraph></section>}
    </div>}
  </section>;
}
