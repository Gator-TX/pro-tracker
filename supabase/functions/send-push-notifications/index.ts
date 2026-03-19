import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

serve(async () => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get all reps
  const { data: reps } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "rep");

  for (const rep of reps || []) {
    // Check if rep has logged any activity in 48 hours
    const { data: recentActivity } = await supabase
      .from("activities")
      .select("id")
      .eq("rep_id", rep.id)
      .gte("created_at", fortyEightHoursAgo)
      .limit(1);

    const noRecentActivity = !recentActivity || recentActivity.length === 0;

    // Check accounts with no activity in 7 days
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("rep_id", rep.id);

    const atRiskAccounts = [];
    for (const account of accounts || []) {
      const { data: accountActivity } = await supabase
        .from("activities")
        .select("id")
        .eq("account_id", account.id)
        .gte("activity_date", sevenDaysAgo.split("T")[0])
        .limit(1);

      if (!accountActivity || accountActivity.length === 0) {
        atRiskAccounts.push(account.name);
      }
    }

    // Get rep push subscription
    const { data: subData } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", rep.id)
      .single();

    if (subData?.subscription) {
      // Send notification if no activity in 48 hours
      if (noRecentActivity) {
        await webpush.sendNotification(
          subData.subscription,
          JSON.stringify({
            title: "Pro-Tracker Reminder",
            body: "You haven't logged any activity in 48 hours. Time to check in!",
            url: "/accounts"
          })
        );
      }

      // Send notification for at risk accounts
      if (atRiskAccounts.length > 0) {
        await webpush.sendNotification(
          subData.subscription,
          JSON.stringify({
            title: "Accounts Need Attention",
            body: `${atRiskAccounts.length} account${atRiskAccounts.length > 1 ? "s" : ""} haven't had activity in 7 days: ${atRiskAccounts.slice(0, 2).join(", ")}`,
            url: "/accounts"
          })
        );
      }
    }

    // Notify managers if rep is at risk
    if (noRecentActivity || atRiskAccounts.length > 0) {
      const { data: managers } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "manager");

      for (const manager of managers || []) {
        const { data: managerSub } = await supabase
          .from("push_subscriptions")
          .select("subscription")
          .eq("user_id", manager.id)
          .single();

        if (managerSub?.subscription) {
          await webpush.sendNotification(
            managerSub.subscription,
            JSON.stringify({
              title: "Rep At Risk",
              body: `${rep.full_name} hasn't logged activity in 48+ hours`,
              url: "/dashboard"
            })
          );
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
});
