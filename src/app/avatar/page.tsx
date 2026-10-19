import { Nav } from "@/components/nav";
import { ACTIONS, canUser } from "@/lib/access";
import { defaultAvatar, parseAvatar } from "@/lib/avatar";
import { db } from "@/lib/db";
import { requirePerson } from "@/lib/session";
import { saveMyAvatarAction } from "./actions";
import { AvatarMaker } from "./maker";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

export default async function AvatarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId, me } = await requirePerson();
  const [canView, search] = await Promise.all([canUser(db(), userId, ACTIONS.view), searchParams]);
  const saved = parseAvatar(me.avatar);
  return (
    <>
      <Nav current="avatar" me={me} canView={canView} />
      <main className="wide">
        {search.notice === "invalid" ? <p className="notice error" role="alert">That avatar could not be saved. Try again.</p> : null}
        <AvatarMaker save={saveMyAvatarAction} start={saved ?? defaultAvatar(me.person_id)} welcome={!saved} name={me.display_name} />
      </main>
    </>
  );
}
