import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase.js";

const TABLE_CALENDARS = process.env.TABLE_CALENDARS || "calendars";
const TABLE_EVENTS = process.env.TABLE_EVENTS || "events";

/**
 * Check if user owns a calendar
 */
export async function requireCalendarOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const calendarId = (req.params as any).id || (req.params as any).calendarId;
    const authUserId = (req as any).user?.id;

    if (!calendarId) {
      return res.status(400).json({ error: "Calendar ID required" });
    }

    // Map auth user -> local users.id
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("user_id", authUserId)
      .maybeSingle();
    
    if (uerr || !urow) {
      return res.status(403).json({ error: "User not found" });
    }

    const ownerId = (urow as any).id;
    const userRole = (urow as any)?.role;

    // ADMIN/MANAGER bypass - full access
    if (userRole === "ADMIN" || userRole === "MANAGER") {
      const { data: calendar } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .select("*")
        .eq("id", calendarId)
        .maybeSingle();
      
      if (calendar) {
        (req as any).calendar = calendar;
        return next();
      }
    }

    // Check if user owns the calendar
    const { data: calendar, error } = await supabaseAdmin
      .from(TABLE_CALENDARS)
      .select("id, owner_id")
      .eq("id", calendarId)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (error || !calendar) {
      return res.status(403).json({ error: "Calendar not found or access denied" });
    }

    // Attach calendar to request for later use
    (req as any).calendar = calendar;
    next();
  } catch (e: any) {
    console.error("[calendarPermissions] requireCalendarOwner error:", e);
    return res.status(500).json({ error: "Permission check failed" });
  }
}

/**
 * Check if user can view a calendar (owner or has can_view permission)
 */
export async function requireCalendarView(req: Request, res: Response, next: NextFunction) {
  try {
    const calendarId = (req.params as any).id || (req.params as any).calendarId || (req.body as any).calendar_id;
    const authUserId = (req as any).user?.id;

    if (!calendarId) {
      return res.status(400).json({ error: "Calendar ID required" });
    }

    // Map auth user -> local users.id
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("user_id", authUserId)
      .maybeSingle();
    
    if (uerr || !urow) {
      return res.status(403).json({ error: "User not found" });
    }

    const userId = (urow as any).id;
    const userRole = (urow as any)?.role;

    // ADMIN/MANAGER bypass - full access to view any calendar
    if (userRole === "ADMIN" || userRole === "MANAGER") {
      const { data: calendar } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .select("*")
        .eq("id", calendarId)
        .maybeSingle();
      
      if (calendar) {
        (req as any).calendar = calendar;
        (req as any).calendarPermission = { isOwner: true, can_view: true, can_edit: true, can_manage: true };
        return next();
      }
    }

    // Check if user owns the calendar
    const { data: calendar } = await supabaseAdmin
      .from(TABLE_CALENDARS)
      .select("*")
      .eq("id", calendarId)
      .maybeSingle();

    if (!calendar) {
      return res.status(404).json({ error: "Calendar not found" });
    }

    // If user is owner, allow
    if ((calendar as any).owner_id === userId) {
      (req as any).calendar = calendar;
      (req as any).calendarPermission = { isOwner: true, can_view: true, can_edit: true, can_manage: true, can_create_events: true };
      return next();
    }

    // If calendar is public, allow view
    if ((calendar as any).is_public) {
      (req as any).calendar = calendar;
      (req as any).calendarPermission = { isOwner: false, can_view: true, can_edit: false, can_manage: false, can_create_events: false };
      return next();
    }

    // Check permissions table
    const { data: permission, error: permErr } = await supabaseAdmin
      .from("calendar_permissions")
      .select("*")
      .eq("calendar_id", calendarId)
      .eq("user_id", userId)
      .maybeSingle();

    if (permErr || !permission || !(permission as any).can_view) {
      return res.status(403).json({ error: "Access denied to this calendar" });
    }

    (req as any).calendar = calendar;
    (req as any).calendarPermission = { 
      isOwner: false, 
      can_view: (permission as any).can_view || false,
      can_edit: (permission as any).can_edit || false,
      can_manage: (permission as any).can_manage || false,
      can_create_events: (permission as any).can_create_events || false,
    };
    next();
  } catch (e: any) {
    console.error("[calendarPermissions] requireCalendarView error:", e);
    return res.status(500).json({ error: "Permission check failed" });
  }
}

/**
 * Check if user can edit events in a calendar
 */
export async function requireCalendarEdit(req: Request, res: Response, next: NextFunction) {
  try {
    const calendarId = (req.params as any).id || (req.params as any).calendarId || (req.body as any).calendar_id;
    const authUserId = (req as any).user?.id;

    if (!calendarId) {
      return res.status(400).json({ error: "Calendar ID required" });
    }

    // Map auth user -> local users.id
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("user_id", authUserId)
      .maybeSingle();
    
    if (uerr || !urow) {
      return res.status(403).json({ error: "User not found" });
    }

    const userId = (urow as any).id;
    const userRole = (urow as any)?.role;

    // ADMIN/MANAGER bypass - full edit access
    if (userRole === "ADMIN" || userRole === "MANAGER") {
      const { data: calendar } = await supabaseAdmin
        .from(TABLE_CALENDARS)
        .select("*")
        .eq("id", calendarId)
        .maybeSingle();
      
      if (calendar) {
        (req as any).calendar = calendar;
        (req as any).calendarPermission = { isOwner: true, can_view: true, can_edit: true, can_manage: true };
        return next();
      }
    }

    // Check if user owns the calendar
    const { data: calendar } = await supabaseAdmin
      .from(TABLE_CALENDARS)
      .select("*")
      .eq("id", calendarId)
      .maybeSingle();

    if (!calendar) {
      return res.status(404).json({ error: "Calendar not found" });
    }

    // If user is owner, allow
    if ((calendar as any).owner_id === userId) {
      (req as any).calendar = calendar;
      (req as any).calendarPermission = { isOwner: true, can_view: true, can_edit: true, can_manage: true, can_create_events: true };
      return next();
    }

    // Check permissions table
    const { data: permission, error: permErr } = await supabaseAdmin
      .from("calendar_permissions")
      .select("*")
      .eq("calendar_id", calendarId)
      .eq("user_id", userId)
      .maybeSingle();

    if (permErr || !permission || !(permission as any).can_edit) {
      return res.status(403).json({ error: "Edit access denied for this calendar" });
    }

    (req as any).calendar = calendar;
    (req as any).calendarPermission = { 
      isOwner: false,
      can_view: (permission as any).can_view || false,
      can_edit: (permission as any).can_edit || false,
      can_manage: (permission as any).can_manage || false,
      can_create_events: (permission as any).can_create_events || false,
    };
    next();
  } catch (e: any) {
    console.error("[calendarPermissions] requireCalendarEdit error:", e);
    return res.status(500).json({ error: "Permission check failed" });
  }
}

/**
 * Check if user can create events in a calendar
 */
export async function requireCalendarCreateEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const calendarId = (req.body as any).calendar_id;
    const authUserId = (req as any).user?.id;

    console.log("[requireCalendarCreateEvent] 🔍 Request:", { 
      authUserId, 
      calendarId,
      userRole: (req as any).profile?.role 
    });

    if (!calendarId) {
      console.warn("[requireCalendarCreateEvent] ❌ Missing calendar_id");
      return res.status(400).json({ error: "calendar_id required in request body" });
    }

    // Map auth user -> local users.id
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("user_id", authUserId)
      .maybeSingle();
    
    console.log("[requireCalendarCreateEvent] 👤 User lookup:", { 
      found: !!urow, 
      userId: (urow as any)?.id,
      role: (urow as any)?.role,
      error: uerr?.message 
    });
    
    if (uerr || !urow) {
      console.warn("[requireCalendarCreateEvent] ❌ User not found");
      return res.status(403).json({ error: "User not found" });
    }

    // ADMIN bypass - full access
    const userRole = (urow as any)?.role;
    if (userRole === "ADMIN" || userRole === "MANAGER") {
      console.log("[requireCalendarCreateEvent] ✅ ADMIN/MANAGER bypass");
      (req as any).calendarPermission = { 
        isOwner: true, 
        can_view: true, 
        can_edit: true, 
        can_manage: true, 
        can_create_events: true 
      };
      return next();
    }

    const userId = (urow as any).id;

    // Check if user owns the calendar
    const { data: calendar } = await supabaseAdmin
      .from(TABLE_CALENDARS)
      .select("*")
      .eq("id", calendarId)
      .maybeSingle();

    console.log("[requireCalendarCreateEvent] 📅 Calendar lookup:", { 
      found: !!calendar, 
      calendarId,
      ownerId: (calendar as any)?.owner_id 
    });

    if (!calendar) {
      console.warn("[requireCalendarCreateEvent] ❌ Calendar not found");
      return res.status(404).json({ error: "Calendar not found" });
    }

    // If user is owner, allow
    if ((calendar as any).owner_id === userId) {
      console.log("[requireCalendarCreateEvent] ✅ User is calendar owner");
      (req as any).calendar = calendar;
      (req as any).calendarPermission = { isOwner: true, can_view: true, can_edit: true, can_manage: true, can_create_events: true };
      return next();
    }

    // Check permissions table
    const { data: permission, error: permErr } = await supabaseAdmin
      .from("calendar_permissions")
      .select("*")
      .eq("calendar_id", calendarId)
      .eq("user_id", userId)
      .maybeSingle();

    console.log("[requireCalendarCreateEvent] 🔐 Permission check:", { 
      found: !!permission, 
      can_create_events: (permission as any)?.can_create_events,
      error: permErr?.message 
    });

    if (permErr || !permission || !(permission as any).can_create_events) {
      console.warn("[requireCalendarCreateEvent] ❌ Access denied");
      return res.status(403).json({ error: "Create event access denied for this calendar" });
    }

    (req as any).calendar = calendar;
    (req as any).calendarPermission = { 
      isOwner: false,
      can_view: (permission as any).can_view || false,
      can_edit: (permission as any).can_edit || false,
      can_manage: (permission as any).can_manage || false,
      can_create_events: (permission as any).can_create_events || false,
    };
    next();
  } catch (e: any) {
    console.error("[calendarPermissions] requireCalendarCreateEvent error:", e);
    return res.status(500).json({ error: "Permission check failed" });
  }
}

/**
 * Check if user owns an event (created it)
 */
export async function requireEventOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = (req.params as any).id || (req.params as any).eventId;
    const authUserId = (req as any).user?.id;

    if (!eventId) {
      return res.status(400).json({ error: "Event ID required" });
    }

    // Map auth user -> local users.id
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("user_id", authUserId)
      .maybeSingle();
    
    if (uerr || !urow) {
      return res.status(403).json({ error: "User not found" });
    }

    const userId = (urow as any).id;
    const userRole = (urow as any).role;

    // ADMIN/MANAGER can edit any event
    if (userRole === "ADMIN" || userRole === "MANAGER") {
      const { data: event, error } = await supabaseAdmin
        .from(TABLE_EVENTS)
        .select("id, created_by_id, calendar_id")
        .eq("id", eventId)
        .maybeSingle();

      if (error || !event) {
        return res.status(403).json({ error: "Event not found" });
      }

      (req as any).event = event;
      return next();
    }

    // Check if user created the event OR owns the calendar
    const { data: event, error } = await supabaseAdmin
      .from(TABLE_EVENTS)
      .select("id, created_by_id, calendar_id, calendars!inner(owner_id)")
      .eq("id", eventId)
      .maybeSingle();

    if (error || !event) {
      return res.status(403).json({ error: "Event not found" });
    }

    const isCreator = (event as any).created_by_id === userId;
    const isCalendarOwner = (event as any).calendars?.owner_id === userId;

    if (!isCreator && !isCalendarOwner) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Attach event to request
    (req as any).event = event;
    next();
  } catch (e: any) {
    console.error("[calendarPermissions] requireEventOwner error:", e);
    return res.status(500).json({ error: "Permission check failed" });
  }
}
