import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin: create a new auth user with a temporary password and assign roles. */
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({
    email: z.string().email(),
    password: z.string().min(8),
    full_name: z.string().min(1),
    roles: z.array(z.string()).default([]),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    // caller must be administrator
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role_name: "administrator",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden — administrators only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");
    const newId = created.user.id;

    // Profile is created by handle_new_user trigger; ensure updated
    await supabaseAdmin.from("profiles").upsert({ id: newId, email: data.email, full_name: data.full_name });

    if (data.roles.length) {
      const { data: roles } = await supabaseAdmin.from("roles").select("id,name").in("name", data.roles);
      if (roles?.length) {
        // Wipe default and set specified
        await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
        await supabaseAdmin.from("user_roles").insert(roles.map((r: any) => ({ user_id: newId, role_id: r.id })));
      }
    }
    return { id: newId };
  });
