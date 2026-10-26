import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { AppIcon } from "@/components/app-icon";
import { ACTIONS, canUser } from "@/lib/access";
import { getPersonAccess, listKinds, visibilityOf } from "@/lib/access-lists";
import { VisibilityToggle } from "../../visibility-toggle";
import { setAppVisibleAction } from "../../actions";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { APP_NOTICES, AppSection, SHARED_NOTICES, pick } from "../../app-access";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// One app of a person's access list, on its own page (Buk, 2026-10-26): the ready role and every action,
// allowed or blocked. The person's page shows all apps as cards that open here.
export default async function PersonAppPage({ params, searchParams }: { params: Promise<{ id: string; app: string }>; searchParams: Promise<Search> }) {
  const { userId, me } = await requireAction(ACTIONS.view);
  const sql = db();
  const [{ id, app: appKey }, search] = await Promise.all([params, searchParams]);
  const [person, kinds, canManage] = await Promise.all([getPersonAccess(sql, id), listKinds(sql), canUser(sql, userId, ACTIONS.manage)]);
  const app = person?.apps.find((a) => a.key === appKey);
  if (!person || !app) notFound();

  const kindLabel = kinds.find((k) => k.key === person.kind)?.name ?? person.kind;
  const noticeKey = typeof search.notice === "string" ? search.notice : "";
  const notice = pick(APP_NOTICES, noticeKey) ?? pick(SHARED_NOTICES, noticeKey);
  const isMe = person.id === me.person_id;
  const vis = visibilityOf(app, person, { canManage, isMe });

  return (
    <>
      <Nav current="people" me={me} canView />
      <main className="wide">
        <p><Link href={`/people/${person.id}`} className="back">← {person.display_name}</Link></p>
        <div className="app-page-head">
          <span className="access-card-icon"><AppIcon appKey={app.key} icon={app.icon} hue={app.hue} size={32} /></span>
          <h1>{app.name}</h1>
          {app.isPrototype ? <span className="pill plain">Prototype</span> : null}
          <span className="app-page-toggle">
            <VisibilityToggle action={setAppVisibleAction} personId={person.id} personName={person.display_name} appKey={app.key}
              appName={app.name} version={app.version} on={vis.on} roleName={vis.roleName} locked={vis.locked} from="app" variant="full" />
          </span>
        </div>
        <p className="muted app-page-desc">
          {app.description ? `${app.description} ` : ""}Choose {person.display_name}&apos;s role, then allow or block single actions for {person.display_name} only.
        </p>
        {!canManage ? <p className="notice">View only</p> : null}
        <div className="apps">
          <AppSection key={app.version} person={person} app={app} kindLabel={kindLabel} canManage={canManage} isMe={isMe} open standalone notice={notice} />
        </div>
      </main>
    </>
  );
}
