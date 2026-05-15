import { InvitationForm } from "@/components/invitation-form";
import { lookupInvitation } from "@/services/auth";

export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await lookupInvitation(token);
  return (
    <InvitationForm
      token={token}
      username={invitation?.username}
      email={invitation?.email}
      invalid={!invitation}
    />
  );
}
