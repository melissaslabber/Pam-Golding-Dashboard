"use client";

// Master organiser V27: annual regional history and reporting-year dropdown.

import "./organizer-complete-v16.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  claimStaffAccess,
  claimStaffActivationToken,
  createStaffActivationToken,
  createStaffProfile,
  deactivateStaffProfile,
  releaseStaffSession,
  resetStaffAccessCode,
  restoreStaffAccess,
  supabase,
  supabaseConfigured,
  updateStaffProfile,
} from "@/lib/supabase";
import {
  createTeamNotifications,
  deleteSharedRecord,
  loadMyNotifications,
  loadSharedRecords,
  loadVisibleProfiles,
  markNotificationRead,
  saveSharedRecord,
  subscribeToMyNotifications,
  subscribeToSharedRecords,
  type RecordKind,
} from "@/lib/organiser-store";
import TenantApplicationPortal from "./tenant-application";
import {
  createManagerAccessCode,
  hasManagerAccessCode,
  loadStaffManagementRecords,
  saveStaffManagementRecord,
  type StaffManagementRecord,
  verifyManagerAccessCode,
} from "@/lib/staff-management";
type Priority = "Urgent" | "High" | "Normal" | "Low";
type View = "personal" | "manager";
type StaffConnection = {
  profileAId: string;
  profileBId: string;
};
async function loadStaffConnections(): Promise<StaffConnection[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("staff_connections")
    .select("profile_a_id,profile_b_id");
  if (error) throw error;
  return (data || []).map((row: any) => ({
    profileAId: row.profile_a_id,
    profileBId: row.profile_b_id,
  }));
}
async function saveStaffConnections(
  profileId: string,
  connectedProfileIds: string[],
) {
  if (!supabase) return;
  const { error: deleteError } = await supabase.from("staff_connections").delete().or(
    `profile_a_id.eq.${profileId},profile_b_id.eq.${profileId}`,
  );
  if (deleteError) throw deleteError;
  if (!connectedProfileIds.length) return;
  const { error } = await supabase.from("staff_connections").insert(
    connectedProfileIds.map((otherId) => {
      const [profileAId, profileBId] = [profileId, otherId].sort();
      return { profile_a_id: profileAId, profile_b_id: profileBId };
    }),
  );
  if (error) throw error;
}
type Task = {
  id: number;
  title: string;
  property: string;
  assignee: string;
  due: string;
  time: string;
  priority: Priority;
  done: boolean;
  category: string;
  notes?: string;
  completedAt?: string;
  archived?: boolean;
  archivedAt?: string;
  sharedWithProfileIds?: string[];
  colourKey?: string;
  colourLabel?: string;
  colourHex?: string;
  colourAccent?: string;
};
type TaskColour = { key: string; label: string; hex: string; accent: string };
const DEFAULT_TASK_COLOURS: TaskColour[] = [
  { key: "sky", label: "Son 1", hex: "#E7EEF3", accent: "#7798AC" },
  { key: "turquoise", label: "Son 2", hex: "#E2EEE9", accent: "#65998A" },
  { key: "pink", label: "Personal reminders", hex: "#F2E8E9", accent: "#B8878F" },
  { key: "green", label: "Husband reminders", hex: "#E8EDE3", accent: "#7F9973" },
  { key: "purple", label: "Work reminders", hex: "#EBE8F0", accent: "#897EA1" },
  { key: "yellow", label: "Other reminders", hex: "#F1EDE3", accent: "#AA9565" },
];
const taskUrgencyRank = (task: Task) => {
  const due = taskDueState(task.due);
  if (task.priority === "Urgent" || due === "Overdue") return 0;
  if (due === "Today") return 1;
  if (task.priority === "High" || due === "Tomorrow") return 2;
  if (task.priority === "Normal") return 3;
  return 4;
};
const taskDisplayPriority = (task: Task) => {
  const due = taskDueState(task.due);
  if (task.priority === "Urgent" || due === "Overdue") return "urgent";
  if (task.priority === "High" || due === "Today" || due === "Tomorrow")
    return "high";
  return task.priority.toLowerCase();
};
const taskDueState = (due: string) => {
  if (["Overdue", "Today", "Tomorrow", "This week"].includes(due)) return due;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return "Future";
  if (due < dateKey(0)) return "Overdue";
  if (due === dateKey(0)) return "Today";
  if (due === dateKey(1)) return "Tomorrow";
  return "Future";
};
const taskDueLabel = (due: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(due) ? formatDate(due) : due;
const taskDateInputValue = (due: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return due;
  if (due === "Today" || due === "Overdue") return dateKey(0);
  if (due === "Tomorrow") return dateKey(1);
  return "";
};
type User = {
  name: string;
  short: string;
  initials: string;
  role: string;
  code: string;
  email: string;
  cellphone: string;
  linkedTo?: string;
  profileId?: string;
  teamId?: string;
  activationToken?: string;
};
type Appointment = {
  id: number | string;
  title: string;
  place: string;
  date: string;
  endDate?: string;
  time: string;
  duration: string;
  allDay?: boolean;
  endTime?: string;
  meetingLink?: string;
  calendarAdded?: boolean;
  googleEventId?: string;
  googleOnly?: boolean;
  colourKey?: string;
  colourLabel?: string;
  colourHex?: string;
  colourAccent?: string;
};
type Maintenance = {
  id: number;
  date: string;
  issue: string;
  property: string;
  assigned: string;
  priority: Priority;
  status: string;
  feedback: string;
  completedAt?: string;
  archived?: boolean;
  archivedAt?: string;
  sharedWithProfileIds?: string[];
};
type AppNotification = {
  id: number;
  recipient: string;
  message: string;
  createdAt: string;
  read: boolean;
  section: "Tasks & To-do" | "Maintenance" | "Lease Renewals" | "New Leases";
  reminderKey?: string;
};
type LeaseRenewal = {
  id: number;
  property: string;
  leaseEndDate: string;
  assigned: string;
  landlordDecision: "Pending" | "Yes" | "No";
  newRent: string;
  renewalTerms: string;
  tenantDecision: "Pending" | "Yes" | "No";
  stage: string;
  completedActions?: string[];
  ficaChanged?: boolean;
  outstandingFicaDocs?: string;
  archived?: boolean;
  archivedAt?: string;
  notes: string;
  sourceName?: string;
  sharedWithProfileIds?: string[];
  lastFollowUpAt?: string;
  nextFollowUpDate: string;
  createdAt: string;
};
type RenewalDraft = {
  id: number;
  property: string;
  leaseEndDate: string;
  assigned: string;
};
type NewLease = {
  id: number;
  property: string;
  occupationDate: string;
  assigned: string;
  stage: string;
  completedActions?: string[];
  archived?: boolean;
  archivedAt?: string;
  notes: string;
  sourceName?: string;
  lastFollowUpAt?: string;
  nextFollowUpDate: string;
  createdAt: string;
  sharedWithProfileIds?: string[];
};
const isConnected = (links: StaffConnection[], first?: string, second?: string) =>
  Boolean(first && second && links.some((link) =>
    (link.profileAId === first && link.profileBId === second) ||
    (link.profileAId === second && link.profileBId === first),
  ));
const canAccessRecord = (item: any, current: User, manager: boolean, assignees: string[]) =>
  manager || assignees.includes(item.assignee || item.assigned) ||
  Boolean(current.profileId && item.sharedWithProfileIds?.includes(current.profileId));
const maintenanceStatuses = [
  "Awaiting contractor to inspect",
  "Awaiting quote",
  "Quote sent to landlord - awaiting go-ahead",
  "Go-ahead received",
  "Awaiting contractor confirmation that repair is complete",
  "Awaiting agent or tenant confirmation that repairs are satisfactory",
  "Completed",
];
const renewalStages = [
  "Contact landlord three months before expiry",
  "Confirm landlord decision, new rent and terms",
  "Contact tenant with landlord terms",
  "Confirm tenant decision or exit tenant on WCU",
  "Send renewal addendum and NMC Form to tenant",
  "Receive signed addendum and NMC Form from tenant",
  "Send tenant-signed addendum and NMC Form to landlord",
  "Receive landlord signature and finalise renewal",
];
const renewalActions = [
  "TFS check on tenant",
  "Lexis KYC check on landlord",
  "Signed addendum received from tenant",
  "Signed addendum received from landlord",
  "No Material Changes Form received from tenant",
  "No Material Changes Form received from landlord",
  "Awaiting documents if FICA has changed",
  "FICA approved",
  "Risk Rating Form approved",
  "Manager Control Form approved",
  "Uploaded on WCU",
];
const newLeaseStages = [
  "Lightstone report obtained",
  "Valuation done",
  "Landlord approval to proceed with letting property",
  "Landlords FICA obtained and KYC done",
  "Landlords FICA sent to FICA Compliance officer",
  "Landlord FICA approved",
  "Property photos obtained and listed on Alchemy",
  "Tenant checks done including TFS Check",
  "Tenant FICA sent to FICA compliance officer for approval",
  "Tenant FICA approved",
  "Draft lease agreement and send to Tenant",
  "Signed lease received from tenant and sent to landlord",
  "Received signed lease from landlord",
  "Tenant paid deposit",
  "Tenant paid first month's rent",
];
const seedMaintenance: Maintenance[] = [];
const initialUsers: User[] = [
  {
    name: "Melissa Slabber",
    short: "Melissa",
    initials: "MS",
    role: "Manager",
    code: "",
    email: "",
    cellphone: "",
  },
  {
    name: "Arno de Wit",
    short: "Arno",
    initials: "AD",
    role: "Manager",
    code: "",
    email: "",
    cellphone: "",
  },
];
const seedTasks: Task[] = [];
const seedAppointments: Appointment[] = [];
const nav = [
  ["Today", LayoutDashboard],
  ["Tasks & To-do", ListTodo],
  ["Appointments", CalendarDays],
  ["Maintenance", Wrench],
  ["Lease Renewals", FileText],
  ["New Leases", Building2],
  ["Properties", Building2],
  ["Reports", ClipboardCheck],
  ["Settings", Settings],
] as const;

export default function Home() {
  const [ready, setReady] = useState(false),
    [restoringSession, setRestoringSession] = useState(supabaseConfigured),
    [users, setUsers] = useState<User[]>(initialUsers),
    [current, setCurrent] = useState<User | null>(null),
    [loginCode, setLoginCode] = useState(""),
    [loginError, setLoginError] = useState(""),
    [recovery, setRecovery] = useState(false);
  const [applicationRequest, setApplicationRequest] = useState<{
    email: string;
    name: string;
    property: string;
  } | null>(null);
  const [showDailyGreeting, setShowDailyGreeting] = useState(false);
  const [tasks, setTasks] = useState(seedTasks),
    [active, setActive] = useState("Today"),
    [view, setView] = useState<View>("personal"),
    [filter, setFilter] = useState("All"),
    [search, setSearch] = useState(""),
    [mobileNav, setMobileNav] = useState(false),
    [dialog, setDialog] = useState(false),
    [notificationsOpen, setNotificationsOpen] = useState(false);
  const [taskColours, setTaskColours] = useState<TaskColour[]>(DEFAULT_TASK_COLOURS);
  const [appointments, setAppointments] = useState(seedAppointments),
    [appointmentOpen, setAppointmentOpen] = useState(false),
    [editingAppointment, setEditingAppointment] = useState<Appointment | null>(
      null,
    ),
    [appointmentForm, setAppointmentForm] = useState({
      title: "",
      place: "",
      date: dateKey(0),
      endDate: dateKey(0),
      time: "09:00",
      endTime: "10:00",
      allDay: false,
      duration: "60 minutes",
      meetingLink: "",
      colourKey: "purple",
      colourLabel: "Work reminders",
      colourHex: "#EBE8F0",
      colourAccent: "#897EA1",
    });
  const [googleAppointments, setGoogleAppointments] = useState<Appointment[]>(
      [],
    ),
    [googleConnected, setGoogleConnected] = useState(false),
    [calendarLoading, setCalendarLoading] = useState(false),
    [calendarError, setCalendarError] = useState("");
  const [maintenance, setMaintenance] = useState(seedMaintenance),
    [maintenanceOpen, setMaintenanceOpen] = useState(false),
    [maintenanceForm, setMaintenanceForm] = useState({
      issue: "",
      property: "",
      assigned: "Melissa",
      priority: "Normal" as Priority,
      status: maintenanceStatuses[0],
      feedback: "",
      sharedWithProfileIds: [] as string[],
    });
  const [renewals, setRenewals] = useState<LeaseRenewal[]>([]),
    [renewalOpen, setRenewalOpen] = useState(false),
    [renewalForm, setRenewalForm] = useState({
      property: "",
      leaseEndDate: "",
      assigned: "Melissa",
      emailText: "",
      sourceName: "",
      sharedWithProfileIds: [] as string[],
    });
  const [newLeases, setNewLeases] = useState<NewLease[]>([]),
    [newLeaseOpen, setNewLeaseOpen] = useState(false),
    [newLeaseForm, setNewLeaseForm] = useState({
      property: "",
      occupationDate: "",
      assigned: "Melissa",
      notes: "",
      sourceName: "",
      sharedWithProfileIds: [] as string[],
    });
  const [reportSettings, setReportSettings] = useState({
    maintenanceEmail: "",
    renewalsEmail: "",
    newLeasesEmail: "",
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [staffManagement, setStaffManagement] = useState<
    StaffManagementRecord[]
  >([]);
  const [staffConnections, setStaffConnections] = useState<StaffConnection[]>([]);
  const [managerUnlocked, setManagerUnlocked] = useState(false),
    [managerGateOpen, setManagerGateOpen] = useState(false),
    [managerCodeExists, setManagerCodeExists] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    title: "",
    property: "",
    assignee: "Melissa",
    due: dateKey(0),
    time: "09:00",
    priority: "Normal" as Priority,
    notes: "",
    sharedWithProfileIds: [] as string[],
    colourKey: "purple",
    colourLabel: "Work reminders",
    colourHex: "#EBE8F0",
    colourAccent: "#897EA1",
  });
  useEffect(() => {
    const activationToken = new URLSearchParams(window.location.search).get("activate");
    if (!activationToken || !supabaseConfigured) return;
    let cancelled = false;
    const activate = async () => {
      try {
        await claimStaffActivationToken(activationToken);
        if (!cancelled) window.location.replace(window.location.origin);
      } catch (error: any) {
        if (!cancelled) {
          window.history.replaceState({}, "", window.location.pathname);
          setLoginError(error?.message || "This activation link is invalid or has expired.");
        }
      }
    };
    void activate();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search),
      encoded = p.get("apply");
    if (encoded) {
      try {
        const [email, name, property] = decodeApplicationDetails(encoded);
        setApplicationRequest({
          email: email || "",
          name: name || "Pam Golding agent",
          property: property || "",
        });
        return;
      } catch {}
    }
    if (p.get("tenantApplication") === "1")
      setApplicationRequest({
        email: p.get("agent") || "",
        name: p.get("name") || "Pam Golding agent",
        property: p.get("property") || "",
      });
  }, []);
  useEffect(() => {
    if (localStorage.getItem("pg-demo-cleanup-v13")) return;
    const clean = (key: string, signatures: Record<string, unknown>[]) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const items = JSON.parse(raw);
        if (!Array.isArray(items)) return;
        const kept = items.filter(
          (item) =>
            !signatures.some((signature) =>
              Object.entries(signature).every(
                ([field, value]) => item?.[field] === value,
              ),
            ),
        );
        localStorage.setItem(key, JSON.stringify(kept));
      } catch {}
    };
    clean("pg-tasks", [
      {
        title: "Follow up outstanding FICA",
        property: "14 Nantes Street, Paarl",
      },
      {
        title: "Send renewal proposal to landlord",
        property: "8 Oak Avenue, Wellington",
      },
      {
        title: "Complete incoming inspection report",
        property: "La Vie Estate · Unit 21",
      },
      {
        title: "Confirm key collection with tenant",
        property: "Bergendal · Unit 6",
      },
      {
        title: "Upload signed lease and mandate",
        property: "22 Main Road, Paarl",
      },
    ]);
    clean("pg-maintenance", [
      {
        issue: "Burst pipe beneath kitchen sink",
        property: "Groenvlei · Unit 9",
      },
      {
        issue: "Bedroom window does not close",
        property: "8 Oak Avenue, Wellington",
      },
    ]);
    clean("pg-appointments", [
      { title: "Rental pipeline meeting", place: "Paarl office · Boardroom" },
      { title: "Landlord meeting", place: "La Vie Estate · Unit 21" },
      { title: "Incoming inspection", place: "Groenvlei" },
    ]);
    localStorage.setItem("pg-demo-cleanup-v13", "done");
  }, []);
  useEffect(() => {
    const savedUsers = localStorage.getItem("pg-users"),
      saved = localStorage.getItem("pg-user"),
      savedTasks = localStorage.getItem("pg-tasks"),
      savedMaintenance = localStorage.getItem("pg-maintenance"),
      savedAppointments = localStorage.getItem("pg-appointments"),
      savedNotifications = localStorage.getItem("pg-notifications"),
      savedRenewals = localStorage.getItem("pg-renewals"),
      savedNewLeases = localStorage.getItem("pg-new-leases"),
      savedTaskColours = localStorage.getItem("pg-task-colours"),
      savedReportSettings = localStorage.getItem("pg-report-settings"),
      storedUsers: User[] = savedUsers ? JSON.parse(savedUsers) : initialUsers,
      loaded = storedUsers.map((u) =>
        u.role === "Manager" ? { ...u, linkedTo: undefined } : u,
      );
    localStorage.setItem("pg-users", JSON.stringify(loaded));
    setUsers(loaded);
    if (savedTasks) setTasks(JSON.parse(savedTasks));
    if (savedMaintenance) setMaintenance(JSON.parse(savedMaintenance));
    if (savedAppointments) setAppointments(JSON.parse(savedAppointments));
    if (savedNotifications) setNotifications(JSON.parse(savedNotifications));
    if (savedRenewals) setRenewals(JSON.parse(savedRenewals));
    if (savedNewLeases) setNewLeases(JSON.parse(savedNewLeases));
    if (savedTaskColours) {
      try {
        const savedColours: TaskColour[] = JSON.parse(savedTaskColours);
        setTaskColours(DEFAULT_TASK_COLOURS.map((fallback) => ({ ...fallback, label: savedColours.find((colour) => colour.key === fallback.key)?.label || fallback.label })));
      } catch {}
    }
    if (savedReportSettings) setReportSettings(JSON.parse(savedReportSettings));
    if (saved && !supabaseConfigured) {
      const found = loaded.find((u) => u.name === saved);
      if (found) {
        const key = `pg-greeting-date-${found.name}`,
          today = new Date().toLocaleDateString("en-CA"),
          isFirst = localStorage.getItem(key) !== today;
        setCurrent(found);
        setShowDailyGreeting(isFirst);
        if (isFirst) localStorage.setItem(key, today);
      }
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || !supabaseConfigured) return;
    let cancelled = false;
    const restore = async () => {
      try {
        const profile = await restoreStaffAccess();
        if (!profile || cancelled) return;
        const visibleProfiles = await loadVisibleProfiles(),
          mapped: User[] = visibleProfiles.map((p: any) => ({
            name: p.full_name,
            short: p.short_name,
            initials: p.initials,
            role:
              p.role === "manager"
                ? "Manager"
                : p.role === "assistant"
                  ? "Assistant"
                  : "Agent",
            code: "",
            email: p.email || "",
            cellphone: p.cellphone || "",
            profileId: p.id,
            teamId: p.team_id,
          })),
          found = mapped.find((u) => u.profileId === profile.profile_id) || {
            name: profile.full_name,
            short: profile.short_name,
            initials: profile.initials,
            role:
              profile.role === "manager"
                ? "Manager"
                : profile.role === "assistant"
                  ? "Assistant"
                  : "Agent",
            code: "",
            email: "",
            cellphone: "",
            profileId: profile.profile_id,
            teamId: profile.team_id,
          };
        setUsers(mapped);
        setCurrent(found);
        localStorage.setItem("pg-users", JSON.stringify(mapped));
        localStorage.setItem("pg-user", found.name);
        setView("personal");
      } catch (error) {
        console.error("Session restore failed", error);
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("pg-tasks", JSON.stringify(tasks));
  }, [tasks, ready]);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("pg-task-colours", JSON.stringify(taskColours));
  }, [taskColours, ready]);
  useEffect(() => {
    if (!ready) return;
    const applyPalette = (item: any) => {
      const colour = taskColours.find((option) => option.key === item.colourKey);
      if (!colour || (item.colourHex === colour.hex && item.colourAccent === colour.accent)) return item;
      return { ...item, colourHex: colour.hex, colourAccent: colour.accent, colourLabel: item.colourLabel || colour.label };
    };
    setTasks((all) => all.map(applyPalette));
    setAppointments((all) => all.map(applyPalette));
  }, [taskColours, ready]);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("pg-maintenance", JSON.stringify(maintenance));
  }, [maintenance, ready]);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("pg-appointments", JSON.stringify(appointments));
  }, [appointments, ready]);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("pg-notifications", JSON.stringify(notifications));
  }, [notifications, ready]);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("pg-renewals", JSON.stringify(renewals));
  }, [renewals, ready]);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("pg-new-leases", JSON.stringify(newLeases));
  }, [newLeases, ready]);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("pg-report-settings", JSON.stringify(reportSettings));
  }, [reportSettings, ready]);
  useEffect(() => {
    if (
      !ready ||
      current?.role !== "Manager" ||
      !managerUnlocked ||
      !supabaseConfigured
    )
      return;
    loadStaffManagementRecords()
      .then(setStaffManagement)
      .catch((error) => console.error("Staff management load failed", error));
  }, [ready, current?.profileId, current?.role, managerUnlocked]);
  useEffect(() => {
    if (!ready || !current?.profileId || !supabaseConfigured) return;
    loadStaffConnections()
      .then(setStaffConnections)
      .catch((error) => console.error("Assistant access load failed", error));
  }, [ready, current?.profileId]);
  useEffect(() => {
    if (current && current.role !== "Manager" && view === "manager") {
      setView("personal");
    }
  }, [current?.role, view]);
  useSharedCollection("task", tasks, current, users);
  useSharedCollection("appointment", appointments, current, users);
  useSharedCollection("maintenance", maintenance, current, users);
  useSharedCollection("renewal", renewals, current, users);
  useSharedCollection("new_lease", newLeases, current, users);
  useEffect(() => {
    if (!ready || !current?.profileId || !supabaseConfigured) return;
    const refresh = async () => {
      try {
        const rows = await loadSharedRecords();
        setTasks(
          rows
            .filter((r) => r.record_type === "task")
            .map((r) => ({ ...r.payload, _teamId: r.team_id }) as unknown as Task),
        );
        setAppointments(
          rows
            .filter((r) => r.record_type === "appointment")
            .map((r) => ({ ...r.payload, _teamId: r.team_id }) as unknown as Appointment),
        );
        setMaintenance(
          rows
            .filter((r) => r.record_type === "maintenance")
            .map((r) => ({ ...r.payload, _teamId: r.team_id }) as unknown as Maintenance),
        );
        setRenewals(
          rows
            .filter((r) => r.record_type === "renewal")
            .map((r) => ({ ...r.payload, _teamId: r.team_id }) as unknown as LeaseRenewal),
        );
        setNewLeases(
          rows
            .filter((r) => r.record_type === "new_lease")
            .map((r) => ({ ...r.payload, _teamId: r.team_id }) as unknown as NewLease),
        );
      } catch (error) {
        console.error("Supabase refresh failed", error);
      }
    };
    return subscribeToSharedRecords(refresh);
  }, [ready, current?.profileId]);
  useEffect(() => {
    if (!ready) return;
    const archiveCompleted = () => {
      setTasks((all) =>
        all.map((t) =>
          !t.archived && t.done && shouldArchive(t.completedAt)
            ? { ...t, archived: true }
            : t,
        ),
      );
      setMaintenance((all) =>
        all.map((m) =>
          !m.archived &&
          m.status === "Completed" &&
          shouldArchive(m.completedAt)
            ? { ...m, archived: true }
            : m,
        ),
      );
    };
    archiveCompleted();
    const timer = window.setInterval(archiveCompleted, 30000);
    return () => window.clearInterval(timer);
  }, [ready]);
  const saveUsers = (next: User[]) => {
    setUsers(next);
    localStorage.setItem("pg-users", JSON.stringify(next));
  };
  const renameTaskColour = (key: string, label: string) => {
    const cleanLabel = label.trim() || "Unnamed colour";
    setTaskColours((all) => all.map((colour) => colour.key === key ? { ...colour, label: cleanLabel } : colour));
    setTasks((all) => all.map((task) => task.colourKey === key ? { ...task, colourLabel: cleanLabel } : task));
    setAppointments((all) => all.map((appointment) => appointment.colourKey === key ? { ...appointment, colourLabel: cleanLabel } : appointment));
    setForm((currentForm) => currentForm.colourKey === key ? { ...currentForm, colourLabel: cleanLabel } : currentForm);
  };
  const profileAssignees = current ? getProfileAssignees(users, current) : [];
  const calendarProfileId = current?.profileId || current?.name || "";
  const displayedAppointments = useMemo(() => {
    const storedGoogleIds = new Set(
      appointments.map((a) => a.googleEventId).filter(Boolean),
    );
    return [
      ...appointments,
      ...googleAppointments.filter(
        (a) => !storedGoogleIds.has(a.googleEventId),
      ),
    ];
  }, [appointments, googleAppointments]);
  const linkedUsers = current
    ? users.filter((u) => u.profileId && isConnected(staffConnections, current.profileId, u.profileId))
    : [];
  const assignableUsers = current
    ? users.filter((user) => profileAssignees.includes(user.short) ||
        (user.profileId && isConnected(staffConnections, current.profileId, user.profileId)))
    : [];
  const ownNotifications =
    current?.role === "Manager"
      ? []
      : notifications.filter((n) => n.recipient === current?.short);
  const unreadNotifications = ownNotifications.filter((n) => !n.read).length;
  useEffect(() => {
    if (!current) return;
    setForm((f) => ({ ...f, assignee: current.short }));
    setMaintenanceForm((f) => ({ ...f, assigned: current.short }));
    setRenewalForm((f) => ({ ...f, assigned: current.short }));
    setNewLeaseForm((f) => ({ ...f, assigned: current.short }));
  }, [current?.short]);
  const refreshGoogleCalendar = async () => {
    if (!calendarProfileId) return;
    setCalendarLoading(true);
    setCalendarError("");
    try {
      const response = await fetch("/api/google/events", {
          headers: { "x-profile-id": calendarProfileId },
        }),
        result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Calendar could not sync.");
      setGoogleAppointments(
        (result.events || [])
          .filter((event: any) => event.status !== "cancelled")
          .map(googleEventToAppointment),
      );
      setGoogleConnected(true);
    } catch (error: any) {
      setCalendarError(error?.message || "Calendar could not sync.");
    } finally {
      setCalendarLoading(false);
    }
  };
  useEffect(() => {
    if (!calendarProfileId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch(
            `/api/google/status?profileId=${encodeURIComponent(calendarProfileId)}`,
          ),
          result = await response.json();
        if (cancelled) return;
        setGoogleConnected(Boolean(result.connected));
        if (result.connected) void refreshGoogleCalendar();
      } catch {}
    };
    void check();
    const params = new URLSearchParams(window.location.search);
    if (params.has("google")) {
      const reason = params.get("reason");
      window.history.replaceState({}, "", window.location.pathname);
      if (params.get("google") === "error")
        setCalendarError(
          `Google Calendar could not be connected${reason ? ` (${reason})` : ""}. Please try again.`,
        );
    }
    return () => {
      cancelled = true;
    };
  }, [calendarProfileId]);
  useEffect(() => {
    if (!googleConnected || !calendarProfileId) return;
    const timer = window.setInterval(
      () => void refreshGoogleCalendar(),
      300000,
    );
    return () => window.clearInterval(timer);
  }, [googleConnected, calendarProfileId]);
  const connectGoogleCalendar = () => {
    if (calendarProfileId)
      window.location.href = `/api/google/connect?profileId=${encodeURIComponent(calendarProfileId)}`;
  };
  const disconnectGoogleCalendar = async () => {
    await fetch("/api/google/disconnect", { method: "POST" });
    setGoogleConnected(false);
    setGoogleAppointments([]);
    setCalendarError("");
  };
  useEffect(() => {
    if (!ready || !current?.profileId || !supabaseConfigured) return;
    if (current.role === "Manager") {
      setNotifications([]);
      return;
    }
    const refresh = async () => {
      try {
        const rows = await loadMyNotifications();
        setNotifications(
          rows.map((row) => ({
            id: Number(row.id),
            recipient: current.short,
            message: row.message,
            createdAt: row.created_at,
            read: row.read,
            section: row.section as AppNotification["section"],
            reminderKey: row.reminder_key || undefined,
          })),
        );
      } catch (error) {
        console.error("Notification refresh failed", error);
      }
    };
    void refresh();
    return subscribeToMyNotifications(refresh);
  }, [ready, current?.profileId, current?.role, current?.short]);
  const deliverNotification = (
    recipients: User[],
    message: string,
    section: AppNotification["section"],
    reminderKey?: string,
  ) => {
    if (!current) return;
    const eligible = recipients.filter(
      (u) => u.role !== "Manager" && u.profileId && u.teamId,
    );
    if (!eligible.length) return;
    if (supabaseConfigured) {
      void createTeamNotifications(
        eligible.map((u) => ({
          recipientProfileId: u.profileId!,
          teamId: u.teamId!,
          message,
          section,
          reminderKey,
        })),
      ).catch((error) => console.error("Notification delivery failed", error));
    } else {
      const now = Date.now();
      setNotifications((all) => [
        ...eligible.map((u, index) => ({
          id: now + index,
          recipient: u.short,
          message,
          createdAt: new Date().toISOString(),
          read: false,
          section,
          reminderKey,
        })),
        ...all,
      ]);
    }
  };
  useEffect(() => {
    if (!ready || !current || current.role === "Manager") return;
    const due = renewals.filter(
      (r) =>
        (profileAssignees.includes(r.assigned) || Boolean(current?.profileId && r.sharedWithProfileIds?.includes(current.profileId))) &&
        !renewalComplete(r) &&
        r.nextFollowUpDate <= dateKey(0),
    );
    for (const r of due) {
      const key = `renewal-${r.id}-${r.nextFollowUpDate}-${current.short}`;
      if (!notifications.some((n) => n.reminderKey === key))
        deliverNotification(
          [current],
          daysUntil(r.leaseEndDate) <= 31
            ? `VERY URGENT: ${r.property} expires within one month and is not finalised. Finalise ASAP.`
            : `Follow up the lease renewal for ${r.property}.`,
          "Lease Renewals",
          key,
        );
    }
  }, [
    ready,
    current?.profileId,
    current?.role,
    current?.short,
    renewals,
    notifications.length,
  ]);
  useEffect(() => {
    if (!ready || !current || current.role === "Manager") return;
    const due = newLeases.filter(
      (l) =>
        (profileAssignees.includes(l.assigned) || Boolean(current?.profileId && l.sharedWithProfileIds?.includes(current.profileId))) &&
        !workflowComplete(newLeaseStages, l.stage) &&
        l.nextFollowUpDate <= dateKey(0),
    );
    for (const l of due) {
      const key = `new-lease-${l.id}-${l.nextFollowUpDate}-${current.short}`;
      if (!notifications.some((n) => n.reminderKey === key))
        deliverNotification(
          [current],
          daysUntil(l.occupationDate) <= 14
            ? `VERY URGENT: ${l.property} occupation is within two weeks. Finalise and upload to WCU ASAP.`
            : `Follow up the new lease for ${l.property}.`,
          "New Leases",
          key,
        );
    }
  }, [
    ready,
    current?.profileId,
    current?.role,
    current?.short,
    newLeases,
    notifications.length,
  ]);
  const notifyLinked = (message: string, section: AppNotification["section"]) =>
    deliverNotification(
      linkedUsers.filter((u) => u.short !== current?.short),
      message,
      section,
    );
  const notifyRelevant = (
    item: any,
    message: string,
    section: AppNotification["section"],
  ) => {
    const recipients = users.filter(
      (user) =>
        user.short !== current?.short &&
        (user.short === (item.assignee || item.assigned) ||
          (user.profileId && item.sharedWithProfileIds?.includes(user.profileId)) ||
          (item._teamId && user.role === "Agent" && user.teamId === item._teamId)),
    );
    deliverNotification(recipients, message, section);
  };
  const openNotification = (notification: AppNotification) => {
    setActive(notification.section);
    setNotificationsOpen(false);
    if (!notification.read) {
      setNotifications((all) =>
        all.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
      if (supabaseConfigured)
        void markNotificationRead(notification.id).catch((error) =>
          console.error("Notification update failed", error),
        );
    }
  };
  const handleTaskStatus = (task: Task, done: boolean) =>
    notifyRelevant(task,
      `${current?.short} marked “${task.title}” ${done ? "completed" : "open again"}.`,
      "Tasks & To-do",
    );
  const handleMaintenanceStatus = (item: Maintenance, status: string) =>
    notifyRelevant(item,
      `${current?.short} changed “${item.issue}” to ${status}.`,
      "Maintenance",
    );
  const handleRenewalUpdate = (item: LeaseRenewal, message: string) =>
    notifyRelevant(item,
      `${current?.short} updated ${item.property}: ${message}.`,
      "Lease Renewals",
    );
  const handleNewLeaseUpdate = (item: NewLease, message: string) =>
    notifyRelevant(item,
      `${current?.short} updated new lease ${item.property}: ${message}.`,
      "New Leases",
    );
  const login = async () => {
    try {
      setLoginError("");
      let found: User | undefined;
      if (supabaseConfigured) {
        const profile = await claimStaffAccess(loginCode),
          visibleProfiles = await loadVisibleProfiles();
        const mapped: User[] = visibleProfiles.map((p: any) => ({
          name: p.full_name,
          short: p.short_name,
          initials: p.initials,
          role:
            p.role === "manager"
              ? "Manager"
              : p.role === "assistant"
                ? "Assistant"
                : "Agent",
          code: "",
          email: p.email || "",
          cellphone: p.cellphone || "",
          profileId: p.id,
          teamId: p.team_id,
        }));
        found = mapped.find((u) => u.profileId === profile.profile_id) || {
          name: profile.full_name,
          short: profile.short_name,
          initials: profile.initials,
          role:
            profile.role === "manager"
              ? "Manager"
              : profile.role === "assistant"
                ? "Assistant"
                : "Agent",
          code: "",
          email: "",
          cellphone: "",
          profileId: profile.profile_id,
          teamId: profile.team_id,
        };
        setUsers(mapped);
        localStorage.setItem("pg-users", JSON.stringify(mapped));
        const remote = await loadSharedRecords();
        if (remote.length) {
          setTasks(
            remote
              .filter((r) => r.record_type === "task")
              .map((r) => ({ ...r.payload, _teamId: r.team_id }) as unknown as Task),
          );
          setAppointments(
            remote
              .filter((r) => r.record_type === "appointment")
              .map((r) => ({ ...r.payload, _teamId: r.team_id }) as unknown as Appointment),
          );
          setMaintenance(
            remote
              .filter((r) => r.record_type === "maintenance")
              .map((r) => ({ ...r.payload, _teamId: r.team_id }) as unknown as Maintenance),
          );
          setRenewals(
            remote
              .filter((r) => r.record_type === "renewal")
              .map((r) => ({ ...r.payload, _teamId: r.team_id }) as unknown as LeaseRenewal),
          );
          setNewLeases(
            remote
              .filter((r) => r.record_type === "new_lease")
              .map((r) => ({ ...r.payload, _teamId: r.team_id }) as unknown as NewLease),
          );
        } else {
          const teamId = found.teamId!,
            profileId = found.profileId!,
            uploads = [
              ...tasks.map((x) =>
                saveSharedRecord("task", teamId, profileId, x as any),
              ),
              ...appointments.map((x) =>
                saveSharedRecord("appointment", teamId, profileId, x as any),
              ),
              ...maintenance.map((x) =>
                saveSharedRecord("maintenance", teamId, profileId, x as any),
              ),
              ...renewals.map((x) =>
                saveSharedRecord("renewal", teamId, profileId, x as any),
              ),
              ...newLeases.map((x) =>
                saveSharedRecord("new_lease", teamId, profileId, x as any),
              ),
            ];
          await Promise.all(uploads);
        }
      } else found = users.find((u) => u.code === loginCode);
      if (!found) {
        setLoginError("That access code is not recognised.");
        return;
      }
      const key = `pg-greeting-date-${found.name}`,
        today = new Date().toLocaleDateString("en-CA"),
        isFirst = localStorage.getItem(key) !== today;
      localStorage.setItem("pg-user", found.name);
      localStorage.setItem(key, today);
      setCurrent(found);
      setShowDailyGreeting(isFirst);
      setView("personal");
    } catch (error: any) {
      setLoginError(
        error?.message?.includes("recognised")
          ? "That access code is not recognised."
          : "Could not connect securely. Please try again.",
      );
    }
  };
  const logout = () => {
    localStorage.removeItem("pg-user");
    void releaseStaffSession();
    setCurrent(null);
    setManagerUnlocked(false);
    setManagerGateOpen(false);
    setMobileNav(false);
    setLoginCode("");
  };
  const visible = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            !t.archived &&
            (profileAssignees.includes(t.assignee) || Boolean(current?.profileId && t.sharedWithProfileIds?.includes(current.profileId))) &&
            (filter === "All" ||
              (filter === "Mine" && (profileAssignees.includes(t.assignee) || Boolean(current?.profileId && t.sharedWithProfileIds?.includes(current.profileId)))) ||
              (filter === "Urgent" && t.priority === "Urgent") ||
              (filter === "Completed" && t.done)) &&
            `${t.title} ${t.property} ${t.assignee} ${t.notes || ""}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort(
          (a, b) =>
            Number(a.done) -
            Number(b.done) +
            taskUrgencyRank(a) -
            taskUrgencyRank(b),
        ),
    [tasks, filter, search, view, profileAssignees],
  );
  const addTask = () => {
    if (!form.title.trim()) return;
    const item: Task = {
        ...form,
        property: form.property || "General office",
        id: Date.now(),
        done: false,
        category: "General",
      };
    setTasks((p) => [...p, item]);
    notifyRelevant(
      item,
      `${current?.short} gave you access to a task: “${form.title}”.`,
      "Tasks & To-do",
    );
    setForm({
      title: "",
      property: "",
      assignee: current?.short || "Melissa",
      due: dateKey(0),
      time: "09:00",
      priority: "Normal",
      notes: "",
      sharedWithProfileIds: [],
      colourKey: "purple",
      colourLabel: taskColours.find((colour) => colour.key === "purple")?.label || "Work reminders",
      colourHex: "#EBE8F0",
      colourAccent: "#897EA1",
    });
    setDialog(false);
  };
  const addAppointment = async () => {
    if (!appointmentForm.title.trim() || !calendarProfileId) return;
    if (appointmentForm.endDate < appointmentForm.date) {
      setCalendarError("The To date cannot be before the From date.");
      return;
    }
    if (
      !appointmentForm.allDay &&
      appointmentForm.endDate === appointmentForm.date &&
      appointmentForm.endTime <= appointmentForm.time
    ) {
      setCalendarError("The end time must be later than the start time.");
      return;
    }
    if (!googleConnected) {
      setCalendarError("Connect Google Calendar before adding an appointment.");
      setAppointmentOpen(false);
      return;
    }
    setCalendarLoading(true);
    try {
      const draft = {
          ...appointmentForm,
          place: appointmentForm.place || "Location to be confirmed",
        },
        response = await fetch("/api/google/events", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-profile-id": calendarProfileId,
          },
          body: JSON.stringify(appointmentToGoogleEvent(draft)),
        }),
        result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Appointment could not be saved.");
      const event: Appointment = {
        ...draft,
        id: Date.now(),
        calendarAdded: true,
        googleEventId: result.id,
      };
      setAppointments((p) => [...p, event]);
      setAppointmentForm({
        title: "",
        place: "",
        date: dateKey(0),
        endDate: dateKey(0),
        time: "09:00",
        endTime: "10:00",
        allDay: false,
        duration: "60 minutes",
        meetingLink: "",
        colourKey: "purple",
        colourLabel: taskColours.find((colour) => colour.key === "purple")?.label || "Work reminders",
        colourHex: "#EBE8F0",
        colourAccent: "#897EA1",
      });
      setAppointmentOpen(false);
      await refreshGoogleCalendar();
    } catch (error: any) {
      setCalendarError(error?.message || "Appointment could not be saved.");
    } finally {
      setCalendarLoading(false);
    }
  };
  const saveAppointment = async () => {
    if (!editingAppointment?.title.trim()) return;
    const edited = editingAppointment;
    const editedEndDate = edited.endDate || edited.date;
    if (editedEndDate < edited.date) {
      setCalendarError("The To date cannot be before the From date.");
      return;
    }
    if (
      !edited.allDay &&
      editedEndDate === edited.date &&
      edited.endTime &&
      edited.endTime <= edited.time
    ) {
      setCalendarError("The end time must be later than the start time.");
      return;
    }
    try {
      if (edited.googleEventId && calendarProfileId) {
        const response = await fetch("/api/google/events", {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-profile-id": calendarProfileId,
            },
            body: JSON.stringify({
              eventId: edited.googleEventId,
              ...appointmentToGoogleEvent(edited),
            }),
          }),
          result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || "Google Calendar could not be updated.",
          );
      }
      if (!edited.googleOnly)
        setAppointments((all) =>
          all.map((a) => (a.id === edited.id ? edited : a)),
        );
      setEditingAppointment(null);
      if (edited.googleEventId) await refreshGoogleCalendar();
    } catch (error: any) {
      setCalendarError(error?.message || "Appointment could not be updated.");
    }
  };
  const deleteAppointment = async (id: number | string) => {
    if (!window.confirm("Delete this meeting or appointment?")) return;
    const item = displayedAppointments.find((a) => a.id === id);
    try {
      if (item?.googleEventId && calendarProfileId) {
        const response = await fetch(
            `/api/google/events?eventId=${encodeURIComponent(item.googleEventId)}`,
            {
              method: "DELETE",
              headers: { "x-profile-id": calendarProfileId },
            },
          ),
          result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || "Google Calendar event could not be deleted.",
          );
      }
      setAppointments((all) => all.filter((a) => a.id !== id));
      setGoogleAppointments((all) =>
        all.filter(
          (a) => a.id !== id && a.googleEventId !== item?.googleEventId,
        ),
      );
      setEditingAppointment(null);
    } catch (error: any) {
      setCalendarError(error?.message || "Appointment could not be deleted.");
    }
  };
  const addMaintenance = () => {
    if (!maintenanceForm.issue.trim() || !maintenanceForm.property.trim())
      return;
    const item: Maintenance = {
        ...maintenanceForm,
        id: Date.now(),
        date: new Intl.DateTimeFormat("en-ZA", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date()),
      };
    setMaintenance((all) => [item, ...all]);
    notifyRelevant(
      item,
      `${current?.short} gave you access to maintenance: “${maintenanceForm.issue}”.`,
      "Maintenance",
    );
    setMaintenanceForm({
      issue: "",
      property: "",
      assigned: current?.short || "Melissa",
      priority: "Normal",
      status: maintenanceStatuses[0],
      feedback: "",
      sharedWithProfileIds: [],
    });
    setMaintenanceOpen(false);
  };
  const addRenewal = () => {
    if (!renewalForm.property.trim() || !renewalForm.leaseEndDate) return;
    const contactDate = renewalContactDate(renewalForm.leaseEndDate),
      item: LeaseRenewal = {
        id: Date.now(),
        property: renewalForm.property.trim(),
        leaseEndDate: renewalForm.leaseEndDate,
        assigned: renewalForm.assigned,
        landlordDecision: "Pending",
        newRent: "",
        renewalTerms: "",
        tenantDecision: "Pending",
        stage: numberedStep(renewalStages, 0),
        completedActions: [],
        ficaChanged: false,
        outstandingFicaDocs: "",
        notes: renewalForm.emailText.trim(),
        sourceName: renewalForm.sourceName || undefined,
        lastFollowUpAt: undefined,
        nextFollowUpDate: contactDate < dateKey(0) ? dateKey(0) : contactDate,
        createdAt: new Date().toISOString(),
      };
    setRenewals((all) => [item, ...all]);
    notifyRelevant(
      item,
      `${current?.short} gave you access to a lease renewal for ${item.property}.`,
      "Lease Renewals",
    );
    setRenewalForm({
      property: "",
      leaseEndDate: "",
      assigned: current?.short || "Melissa",
      emailText: "",
      sourceName: "",
      sharedWithProfileIds: [],
    });
    setRenewalOpen(false);
  };
  const addRenewalsBatch = (drafts: RenewalDraft[], sourceName: string) => {
    const valid = drafts.filter((d) => d.property.trim() && d.leaseEndDate);
    if (!valid.length) return;
    const now = Date.now(),
      createdAt = new Date().toISOString(),
      items: LeaseRenewal[] = valid.map((draft, index) => {
        const contactDate = renewalContactDate(draft.leaseEndDate);
        return {
          id: now + index,
          property: draft.property.trim(),
          leaseEndDate: draft.leaseEndDate,
          assigned: draft.assigned,
          landlordDecision: "Pending",
          newRent: "",
          renewalTerms: "",
          tenantDecision: "Pending",
          stage: numberedStep(renewalStages, 0),
          completedActions: [],
          ficaChanged: false,
          outstandingFicaDocs: "",
          notes: "",
          sourceName: sourceName || undefined,
          lastFollowUpAt: undefined,
          nextFollowUpDate: contactDate < dateKey(0) ? dateKey(0) : contactDate,
          createdAt,
        };
      });
    setRenewals((all) => [...items, ...all]);
    notifyLinked(
      `${current?.short} added ${items.length} lease renewal${items.length === 1 ? "" : "s"} from an expiry-list email.`,
      "Lease Renewals",
    );
    setRenewalForm({
      property: "",
      leaseEndDate: "",
      assigned: current?.short || "Melissa",
      emailText: "",
      sourceName: "",
      sharedWithProfileIds: [],
    });
    setRenewalOpen(false);
  };
  const addNewLease = () => {
    if (!newLeaseForm.property.trim() || !newLeaseForm.occupationDate) return;
    const item: NewLease = {
      id: Date.now(),
      property: newLeaseForm.property.trim(),
      occupationDate: newLeaseForm.occupationDate,
      assigned: newLeaseForm.assigned,
      stage: numberedStep(newLeaseStages, 0),
      notes: newLeaseForm.notes,
      sourceName: newLeaseForm.sourceName || undefined,
      nextFollowUpDate: dateKey(0),
      createdAt: new Date().toISOString(),
    };
    setNewLeases((all) => [item, ...all]);
    notifyRelevant(
      item,
      `${current?.short} gave you access to a new lease for ${item.property}.`,
      "New Leases",
    );
    setNewLeaseForm({
      property: "",
      occupationDate: "",
      assigned: current?.short || "Melissa",
      notes: "",
      sourceName: "",
      sharedWithProfileIds: [],
    });
    setNewLeaseOpen(false);
  };
  if (applicationRequest)
    return <TenantApplicationPortal agent={applicationRequest} />;
  if (!ready || restoringSession) return null;
  if (!current)
    return (
      <main className="login-shell">
        <section className="login-brand">
          <img src="/pam-golding-gate.jpg?v=7" alt="Pam Golding Properties" />
          <p>PAM GOLDING</p>
          <span>PROPERTIES</span>
        </section>
        <section className="login-panel">
          {!recovery ? (
            <div className="login-card">
              <span className="login-icon">
                <KeyRound />
              </span>
              <p className="login-kicker">RENTALS ORGANISER</p>
              <h1>Welcome back</h1>
              <p className="login-copy">
                Enter the private access code provided by your manager.
              </p>
              <label>
                Access code
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={loginCode}
                  onChange={(e) =>
                    setLoginCode(e.target.value.replace(/\D/g, ""))
                  }
                  onKeyDown={(e) => e.key === "Enter" && login()}
                  placeholder="Enter your code"
                />
              </label>
              {loginError && <p className="login-error">{loginError}</p>}
              <Button className="login-button" onClick={login}>
                Sign in
              </Button>
              <button className="forgot" onClick={() => setRecovery(true)}>
                Forgot your access code?
              </button>
            </div>
          ) : (
            <div className="login-card">
              <span className="login-icon">
                <ShieldCheck />
              </span>
              <p className="login-kicker">ACCOUNT RECOVERY</p>
              <h1>Request a new code</h1>
              <p className="login-copy">
                For security, contact Melissa or Arno directly by email or
                WhatsApp. A manager will verify your identity and generate a new
                access code for you.
              </p>
              <Button
                className="login-button"
                onClick={() => setRecovery(false)}
              >
                Back to sign in
              </Button>
            </div>
          )}
        </section>
      </main>
    );
  const isManager = view === "manager";
  return (
    <main className="app-shell" data-release="portfolio-growth-and-procurement-v31">
      <style>{`.manager-section-back{margin:0 0 16px;padding:10px 14px;border:1px solid #c8ddd5;border-radius:10px;background:#fff;color:#08705a;font-weight:800;cursor:pointer}@media(max-width:620px){.workspace>header{display:flex!important;position:sticky!important;top:0!important;z-index:30!important;height:70px!important;padding:0 13px!important;background:#fff!important}.header-logo{display:block!important;width:38px!important;height:38px!important;object-fit:cover!important;border-radius:9px!important}.mobile-primary-nav{position:fixed!important;display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;left:0!important;right:0!important;bottom:0!important;width:100%!important;z-index:999!important;background:#fff!important;border-top:1px solid #d4e4de!important;padding:5px 5px calc(6px + env(safe-area-inset-bottom))!important}.content{padding-bottom:110px!important}}`}</style>
      <aside className={`side-panel ${mobileNav ? "side-open" : ""}`}>
        <div className="brand">
          <img
            className="brand-logo"
            src="/pam-golding-gate.jpg?v=7"
            alt="Pam Golding Properties"
          />
          <div>
            <strong>Pam Golding</strong>
            <span>PROPERTIES · RENTALS</span>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileNav(false)}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={active === label ? "active" : ""}
              onClick={() => {
                setActive(label);
                setMobileNav(false);
              }}
            >
              <Icon />
              <span>{label}</span>
              {label === "Tasks & To-do" && (
                <b>
                  {
                    tasks.filter(
                      (t) =>
                        !t.archived &&
                        !t.done &&
                        (profileAssignees.includes(t.assignee) || Boolean(current?.profileId && t.sharedWithProfileIds?.includes(current.profileId))),
                    ).length
                  }
                </b>
              )}
              {label === "Maintenance" &&
                maintenance.some(
                  (m) =>
                    !m.archived &&
                    m.priority === "Urgent" &&
                    m.status !== "Completed",
                ) && <b className="urgent-nav">!</b>}
            </button>
          ))}
        </nav>
        <div className="team-card">
          <span className="eyebrow">REGIONAL RENTALS</span>
          <div className="avatar-row">
            {users.slice(0, 3).map((u) => (
              <span key={u.name}>{u.initials}</span>
            ))}
            {users.length > 3 && <i>+{users.length - 3}</i>}
          </div>
          <p>Boland, Overberg and Cape Region Rentals</p>
          <small>{users.length} users · Managers, agents and assistants</small>
        </div>
        <div className="side-bottom">
          <button className="logout-side" onClick={logout}>
            <LogOut />
            Log out
          </button>
          <div className="profile">
            <div className="avatar">{current.initials}</div>
            <div>
              <strong>{current.name}</strong>
              <span>{current.role} · Personal account</span>
            </div>
            <ChevronDown />
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close menu"
        />
      )}
      <section className="workspace">
        <style>{`
          .personal-category-tag{display:inline-flex!important;align-items:center!important;justify-self:start;width:auto!important;max-width:100%;gap:6px!important;margin-top:4px;padding:4px 9px!important;border:1px solid rgba(23,75,62,.08);border-radius:999px;color:#3d554e!important;font:750 9px/1.2 Arial,sans-serif!important;font-style:normal!important;letter-spacing:.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:none}
          .personal-category-tag i{display:block!important;flex:none;width:7px!important;height:7px!important;border-radius:50%!important;background:var(--category-dot)!important;box-shadow:0 0 0 2px rgba(255,255,255,.75)}
          .task-list article{transition:box-shadow .2s ease,transform .2s ease}.task-list article .personal-category-tag{margin:6px 0 1px}
          .today-detail-section{border-color:#dce6e2!important;box-shadow:0 10px 26px rgba(18,65,54,.055)!important}.today-detail-list>button{padding-top:12px;padding-bottom:12px}.today-detail-list>button>span{gap:4px}.today-detail-list>button.category-calendar-item>i{background:var(--category-accent)!important;box-shadow:none!important}
          .meeting .personal-category-tag{margin:4px 0 5px!important}
        `}</style>
        <header>
          <button
            className="menu-button"
            onClick={() => setMobileNav(true)}
            aria-label="Open menu"
          >
            <Menu />
            <span>Menu</span>
          </button>
          <img
            className="header-logo"
            src="/pam-golding-gate.jpg?v=7"
            alt="Pam Golding Properties"
          />
          <div className="global-search">
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, properties or people"
            />
          </div>
          <div className="view-switch">
            <button
              className={!isManager ? "selected" : ""}
              onClick={() => {
                setView("personal");
                setManagerUnlocked(false);
                setActive("Today");
              }}
            >
              My profile
            </button>
            {current.role === "Manager" && (
              <button
                className={isManager ? "selected" : ""}
                onClick={async () => {
                  setManagerGateOpen(true);
                  setManagerCodeExists(null);
                  try {
                    setManagerCodeExists(await hasManagerAccessCode());
                  } catch {
                    setManagerCodeExists(false);
                  }
                }}
              >
                <ShieldCheck />
                Manager
              </button>
            )}
          </div>
          {current.role !== "Manager" && (
            <div className="notification-wrap">
              <button
                className="icon-button"
                aria-label="Notifications"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell />
                {unreadNotifications > 0 && <b>{unreadNotifications}</b>}
              </button>
              {notificationsOpen && (
                <div className="notification-panel">
                  <div>
                    <strong>Notifications</strong>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      aria-label="Close notifications"
                    >
                      <X />
                    </button>
                  </div>
                  {ownNotifications.length ? (
                    ownNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        className={notification.read ? "" : "unread"}
                        onClick={() => openNotification(notification)}
                      >
                        <Bell />
                        <span>
                          <b>{notification.message}</b>
                          <small>
                            {new Intl.DateTimeFormat("en-ZA", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(notification.createdAt))}
                          </small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="notification-empty">No notifications yet.</p>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            className="icon-button top-more"
            aria-label="More options"
            onClick={() => setMobileNav(true)}
          >
            <MoreHorizontal />
          </button>
          <button className="header-avatar" onClick={logout} title="Log out">
            {current.initials}
          </button>
        </header>
        <div className="page-ribbon">
          <div className="ribbon-brand">
            <img src="/pam-golding-gate.jpg?v=7" alt="" />
            <span>PAM GOLDING PROPERTIES</span>
          </div>
          <small>Boland · Overberg · Cape Region Rentals</small>
        </div>
        <nav className="mobile-primary-nav" aria-label="Main sections">
          {[
            ["Today", LayoutDashboard],
            ["Appointments", CalendarDays],
            ["Tasks & To-do", ListTodo],
            ["Maintenance", Wrench],
            ["Lease Renewals", FileText],
            ["New Leases", Building2],
          ].map(([label, Icon]: any) => {
            const taskCount = tasks.filter(
                (t) =>
                  !t.archived &&
                  !t.done &&
                  (profileAssignees.includes(t.assignee) || Boolean(current?.profileId && t.sharedWithProfileIds?.includes(current.profileId))),
              ).length,
              maintenanceCount = maintenance.filter(
                (m) => !m.archived && m.status !== "Completed",
              ).length;
            return (
              <button
                key={label}
                className={active === label ? "active" : ""}
                onClick={() => setActive(label)}
              >
                <span className="nav-icon">
                  <Icon />
                  {label === "Tasks & To-do" && taskCount > 0 && (
                    <b>{taskCount}</b>
                  )}
                  {label === "Maintenance" && maintenanceCount > 0 && (
                    <b>{maintenanceCount}</b>
                  )}
                </span>
                <span>
                  {label === "Tasks & To-do"
                    ? "Tasks"
                    : label === "Appointments"
                      ? "Meetings"
                      : label === "Lease Renewals"
                        ? "Renewals"
                        : label}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="content">
          <div className="title-row">
            <div>
              <p className="date-label">
                {isManager
                  ? "MANAGER OVERVIEW"
                  : active === "Today"
                    ? `${current.short.toUpperCase()}’S WORKSPACE`
                    : "MY PERSONAL WORKSPACE"}
              </p>
              {active !== "Today" && <h1>{active}</h1>}
              {active === "Today" && (
                <span className="page-date">
                  {new Intl.DateTimeFormat("en-ZA", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(new Date())}
                </span>
              )}
              <p>{sectionSubtitle(active, isManager)}</p>
            </div>
            <div className="title-actions">
              <button
                className="mobile-title-menu"
                onClick={() => setMobileNav(true)}
                aria-label="Open menu"
              >
                <Menu />
              </button>
              {active === "Today" && (
                <>
                  <QuickAddMenu
                    onTask={() => setDialog(true)}
                    onAppointment={() => setAppointmentOpen(true)}
                    onNewLease={() => setNewLeaseOpen(true)}
                    onRenewal={() => setRenewalOpen(true)}
                    onMaintenance={() => setMaintenanceOpen(true)}
                  />
                  <span className="hidden-task-trigger">
                    <TaskDialog
                      dialog={dialog}
                      setDialog={setDialog}
                      form={form}
                      setForm={setForm}
                      addTask={addTask}
                      users={assignableUsers}
                      colours={taskColours}
                      onRenameColour={renameTaskColour}
                    />
                  </span>
                </>
              )}
              {active === "Tasks & To-do" && (
                <TaskDialog
                  dialog={dialog}
                  setDialog={setDialog}
                  form={form}
                  setForm={setForm}
                  addTask={addTask}
                  users={assignableUsers}
                  colours={taskColours}
                  onRenameColour={renameTaskColour}
                />
              )}
              <AppointmentDialog
                open={appointmentOpen}
                setOpen={setAppointmentOpen}
                form={appointmentForm}
                setForm={setAppointmentForm}
                addAppointment={addAppointment}
                showTrigger={active === "Appointments"}
                colours={taskColours}
                onRenameColour={renameTaskColour}
              />
              {active === "Appointments" && (
                <span className="hidden-task-trigger">
                  <TaskDialog
                    dialog={dialog}
                    setDialog={setDialog}
                    form={form}
                    setForm={setForm}
                    addTask={addTask}
                    users={assignableUsers}
                    colours={taskColours}
                    onRenameColour={renameTaskColour}
                  />
                </span>
              )}
            </div>
          </div>
          {active === "Today" && (
            <Today
              tasks={tasks}
              visible={visible}
              setTasks={setTasks}
              filter={filter}
              setFilter={setFilter}
              manager={false}
              current={current}
              profileAssignees={profileAssignees}
              maintenance={maintenance}
              setMaintenance={setMaintenance}
              appointments={displayedAppointments}
              onAddAppointment={() => setAppointmentOpen(true)}
              onEditAppointment={setEditingAppointment}
              onDeleteAppointment={deleteAppointment}
              onAddTask={() => setDialog(true)}
              onAddMaintenance={() => setMaintenanceOpen(true)}
              onTaskStatus={handleTaskStatus}
              onMaintenanceStatus={handleMaintenanceStatus}
              renewals={renewals}
              newLeases={newLeases}
              setActive={setActive}
              calendarControls={{
                connected: googleConnected,
                loading: calendarLoading,
                error: calendarError,
                connect: connectGoogleCalendar,
                refresh: refreshGoogleCalendar,
                disconnect: disconnectGoogleCalendar,
                openAdd: (date?: string) => {
                  if (date)
                    setAppointmentForm((form) => ({
                      ...form,
                      date,
                      endDate: date,
                    }));
                  setAppointmentOpen(true);
                },
                openTask: (date?: string) => {
                  if (date) setForm((form) => ({ ...form, due: date }));
                  setDialog(true);
                },
              }}
            />
          )}
          {active === "Tasks & To-do" && (
            <TasksView
              items={tasks}
              visible={visible}
              setTasks={setTasks}
              manager={false}
              profileAssignees={profileAssignees}
              onTaskStatus={handleTaskStatus}
              colours={taskColours}
              onRenameColour={renameTaskColour}
            />
          )}
          {active === "Appointments" && (
            <CalendarView
              manager={false}
              appointments={displayedAppointments}
              onEdit={setEditingAppointment}
              onDelete={deleteAppointment}
              calendarControls={{
                connected: googleConnected,
                loading: calendarLoading,
                error: calendarError,
                connect: connectGoogleCalendar,
                refresh: refreshGoogleCalendar,
                disconnect: disconnectGoogleCalendar,
                openAdd: (date?: string) => {
                  if (date)
                    setAppointmentForm((form) => ({
                      ...form,
                      date,
                      endDate: date,
                    }));
                  setAppointmentOpen(true);
                },
                openTask: (date?: string) => {
                  if (date) setForm((form) => ({ ...form, due: date }));
                  setDialog(true);
                },
              }}
            />
          )}
          {active === "Maintenance" && (
            <MaintenanceView
              items={maintenance}
              setItems={setMaintenance}
              manager={false}
              current={current}
              users={users}
              onAdd={() => setMaintenanceOpen(true)}
              onStatus={handleMaintenanceStatus}
            />
          )}
          {active === "Lease Renewals" && (
            <RenewalsView
              items={renewals}
              setItems={setRenewals}
              manager={false}
              current={current}
              users={users}
              onAdd={() => setRenewalOpen(true)}
              onUpdate={handleRenewalUpdate}
            />
          )}
          {active === "New Leases" && (
            <NewLeasesChecklistView
              items={newLeases}
              setItems={setNewLeases}
              manager={false}
              current={current}
              users={users}
              onAdd={() => setNewLeaseOpen(true)}
              onUpdate={handleNewLeaseUpdate}
            />
          )}
          {active === "Manager" && isManager && (
            <ManagerHome setActive={setActive} users={users} />
          )}
          {active === "Staff" && isManager && (
            <>
              <button className="manager-section-back" onClick={() => setActive("Manager")}>← Back to Manager</button>
              <TeamView
                manager={isManager}
                current={current}
                users={users}
                saveUsers={saveUsers}
                tasks={tasks}
                setTasks={setTasks}
                onTaskStatus={handleTaskStatus}
                staffManagement={staffManagement}
                setStaffManagement={setStaffManagement}
                staffConnections={staffConnections}
                setStaffConnections={setStaffConnections}
              />
            </>
          )}
          {active === "Reporting" && isManager && (
            <>
              <button className="manager-section-back" onClick={() => setActive("Manager")}>← Back to Manager</button>
              <ManagerReportingView
                users={users}
                records={staffManagement}
                current={current}
                onSave={async (record: StaffManagementRecord) => {
                  setStaffManagement((all: StaffManagementRecord[]) => [
                    ...all.filter((item) => item.profileId !== record.profileId),
                    record,
                  ]);
                  await saveStaffManagementRecord(record);
                }}
              />
            </>
          )}
          {active === "AI Staff Adviser" && isManager && (
            <>
              <button className="manager-section-back" onClick={() => setActive("Manager")}>← Back to Manager</button>
              <ManagerAITeamCoach users={users} records={staffManagement} tasks={tasks} />
            </>
          )}
          {active === "Properties" && (
            <PropertiesView
              tasks={tasks}
              maintenance={maintenance}
              renewals={renewals}
              newLeases={newLeases}
              manager={false}
              current={current}
              users={users}
            />
          )}
          {active === "Reports" && (
            <ReportsView
              tasks={tasks}
              maintenance={maintenance}
              renewals={renewals}
              newLeases={newLeases}
              settings={reportSettings}
              setSettings={setReportSettings}
            />
          )}
          {active === "Settings" && (
            <SettingsView
              settings={reportSettings}
              setSettings={setReportSettings}
              tasks={tasks}
              maintenance={maintenance}
              appointments={appointments}
              renewals={renewals}
              newLeases={newLeases}
              users={users}
              current={current}
              manager={isManager}
              calendarControls={{
                connected: googleConnected,
                loading: calendarLoading,
                error: calendarError,
                connect: connectGoogleCalendar,
                refresh: refreshGoogleCalendar,
                disconnect: disconnectGoogleCalendar,
              }}
            />
          )}
          <MaintenanceDialog
            open={maintenanceOpen}
            setOpen={setMaintenanceOpen}
            form={maintenanceForm}
            setForm={setMaintenanceForm}
            addMaintenance={addMaintenance}
            users={assignableUsers}
          />
          <AppointmentEditDialog
            appointment={editingAppointment}
            setAppointment={setEditingAppointment}
            save={saveAppointment}
            remove={deleteAppointment}
            colours={taskColours}
            onRenameColour={renameTaskColour}
          />
          <RenewalDialog
            open={renewalOpen}
            setOpen={setRenewalOpen}
            form={renewalForm}
            setForm={setRenewalForm}
            addRenewal={addRenewal}
            addRenewalsBatch={addRenewalsBatch}
            users={isManager ? users : assignableUsers}
          />
          <NewLeaseDialog
            open={newLeaseOpen}
            setOpen={setNewLeaseOpen}
            form={newLeaseForm}
            setForm={setNewLeaseForm}
            add={addNewLease}
            users={isManager ? users : assignableUsers}
          />
          <ManagerAccessDialog
            open={managerGateOpen}
            setOpen={setManagerGateOpen}
            codeExists={managerCodeExists}
            unlock={() => {
              setManagerUnlocked(true);
              setView("manager");
              setActive("Manager");
              setManagerGateOpen(false);
            }}
          />
        </div>
      </section>
    </main>
  );
}

function ManagerAccessDialog({ open, setOpen, codeExists, unlock }: any) {
  const [code, setCode] = useState(""),
    [confirmCode, setConfirmCode] = useState(""),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!open) {
      setCode("");
      setConfirmCode("");
      setError("");
    }
  }, [open]);
  const submit = async () => {
    if (!/^\d{4,8}$/.test(code)) {
      setError("Please insert your PIN.");
      return;
    }
    if (codeExists === false && code !== confirmCode) {
        setError("The two PINs do not match.");
      return;
    }
    setChecking(true);
    setError("");
    try {
      const allowed = codeExists
        ? await verifyManagerAccessCode(code)
        : await createManagerAccessCode(code);
      if (!allowed) {
        setError("That Manager PIN is incorrect.");
        return;
      }
      unlock();
    } catch (requestError: any) {
      setError(
        requestError?.message || "Manager access could not be verified.",
      );
    } finally {
      setChecking(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="manager-access-dialog">
        <DialogHeader>
          <div className="manager-lock-icon">
            <KeyRound />
          </div>
          <DialogTitle>
            {codeExists === false
              ? "Create your Manager PIN"
              : "Manager access"}
          </DialogTitle>
          <DialogDescription>
            {codeExists === false
              ? "Choose a private PIN to protect the confidential Manager area."
              : "Insert your PIN to view staff and portfolio information."}
          </DialogDescription>
        </DialogHeader>
        {codeExists === null ? (
          <div className="manager-code-loading">
            <Loader2 className="spin" /> Checking manager security…
          </div>
        ) : (
          <div className="manager-code-fields">
            <label>
              {codeExists ? "Insert PIN" : "Choose PIN"}
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
                }
                placeholder="Insert PIN"
              />
            </label>
            {codeExists === false && (
              <label>
                Confirm PIN
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  value={confirmCode}
                  onChange={(event) =>
                    setConfirmCode(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Enter it again"
                />
              </label>
            )}
            {error && <p className="manager-code-error">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="add-button"
            disabled={checking || codeExists === null}
            onClick={submit}
          >
            {checking ? (
              <>
                <Loader2 className="spin" /> Verifying…
              </>
            ) : codeExists === false ? (
              "Save PIN and open Manager"
            ) : (
              "Unlock Manager"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useSharedCollection(
  kind: RecordKind,
  items: any[],
  current: User | null,
  users: User[],
) {
  const synced = useRef(new Map<string, string>());
  useEffect(() => {
    if (!supabaseConfigured || !current?.profileId || !current.teamId) return;
    const profileId = current.profileId,
      ownTeamId = current.teamId;
    const timer = window.setTimeout(async () => {
      const present = new Set<string>();
      try {
        for (const item of items) {
          const teamId = item._teamId || ownTeamId,
            key = `${kind}:${teamId}:${item.id}`,
            digest = JSON.stringify(item);
          present.add(key);
          if (synced.current.get(key) !== digest) {
            await saveSharedRecord(kind, teamId, profileId, item);
            synced.current.set(key, digest);
          }
        }
        for (const [key] of [...synced.current]) {
          if (key.startsWith(`${kind}:`) && !present.has(key)) {
            const parts = key.split(":"),
              teamId = parts[1],
              localId = parts.slice(2).join(":");
            await deleteSharedRecord(kind, teamId, localId);
            synced.current.delete(key);
          }
        }
      } catch (error) {
        console.error(`Supabase ${kind} sync failed`, error);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [kind, items, current?.profileId, current?.teamId, users]);
}

function sectionSubtitle(active: string, manager: boolean) {
  const x: Record<string, string> = {
    Today: manager
      ? "All team priorities and activity in one place."
      : "Here’s what needs your attention today.",
    "Tasks & To-do": "Day-to-day work, follow-ups and deadlines.",
    Appointments: "Tap any meeting to edit or delete it.",
    Maintenance:
      "Track every reported issue from logging through final confirmation.",
    "Lease Renewals":
      "Start three months early, with very urgent escalation in the final month.",
    "New Leases":
      "Track FICA, compliance, signatures and WCU upload before occupation.",
    Staff: manager
      ? "All staff, agents and assistants grouped by region and office."
      : "Your profile, workload and daily progress.",
    Reporting: "Regional results, year-to-year performance and annual totals.",
    Manager: "Choose whether you want to manage your staff or open reporting.",
    "AI Staff Adviser": "Practical guidance based on your staff information and current workload.",
    Properties: "Tasks and activity grouped by rental property.",
    Reports: "A clear view of completion and overdue work.",
    Settings: "Install the app, back up data and prepare weekly email reports.",
  };
  return x[active];
}
function getProfileAssignees(users: User[], user: User) {
  return [user.short];
}
function shouldArchive(completedAt?: string) {
  if (!completedAt) return false;
  const cutoff = new Date(completedAt);
  cutoff.setHours(23, 59, 0, 0);
  return Date.now() >= cutoff.getTime();
}
function dateKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA");
}
function dateLabel(date: string) {
  if (date === dateKey(0) || date === "Today") return "Today";
  if (date === dateKey(1) || date === "Tomorrow") return "Tomorrow";
  if (date === "This week") return "This week";
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}
function easterSunday(year: number) {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12);
}
function southAfricanPublicHolidays(year: number) {
  const easter = easterSunday(year),
    relative = (offset: number) => {
      const value = new Date(easter);
      value.setDate(value.getDate() + offset);
      return value.toLocaleDateString("en-CA");
    },
    holidays: Array<[string, string]> = [
      [`${year}-01-01`, "New Year’s Day"],
      [`${year}-03-21`, "Human Rights Day"],
      [relative(-2), "Good Friday"],
      [relative(1), "Family Day"],
      [`${year}-04-27`, "Freedom Day"],
      [`${year}-05-01`, "Workers’ Day"],
      [`${year}-06-16`, "Youth Day"],
      [`${year}-08-09`, "National Women’s Day"],
      [`${year}-09-24`, "Heritage Day"],
      [`${year}-12-16`, "Day of Reconciliation"],
      [`${year}-12-25`, "Christmas Day"],
      [`${year}-12-26`, "Day of Goodwill"],
    ],
    result = new Map(holidays);
  holidays.forEach(([date, name]) => {
    const day = new Date(`${date}T12:00:00`);
    if (day.getDay() === 0) {
      day.setDate(day.getDate() + 1);
      const observed = day.toLocaleDateString("en-CA");
      result.set(
        observed,
        result.has(observed)
          ? `${result.get(observed)} · ${name} observed`
          : `${name} observed`,
      );
    }
  });
  return result;
}
function appointmentToGoogleEvent(
  a: Pick<
    Appointment,
    | "title"
    | "place"
    | "date"
    | "endDate"
    | "time"
    | "endTime"
    | "allDay"
    | "duration"
    | "meetingLink"
  >,
) {
  if (a.allDay) {
    const nextDay = new Date(`${a.endDate || a.date}T12:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    return {
      summary: a.title,
      location: a.place || "",
      description: a.meetingLink ? `Online meeting: ${a.meetingLink}` : "",
      start: { date: a.date },
      end: { date: nextDay.toLocaleDateString("en-CA") },
    };
  }
  const minutes = parseInt(a.duration) || 60,
    start = new Date(`${a.date}T${a.time}:00+02:00`),
    end = a.endTime
      ? new Date(`${a.endDate || a.date}T${a.endTime}:00+02:00`)
      : new Date(start.getTime() + minutes * 60000);
  return {
    summary: a.title,
    location: a.place || "",
    description: a.meetingLink ? `Online meeting: ${a.meetingLink}` : "",
    start: { dateTime: start.toISOString(), timeZone: "Africa/Johannesburg" },
    end: { dateTime: end.toISOString(), timeZone: "Africa/Johannesburg" },
  };
}
function googleEventToAppointment(event: any): Appointment {
  const allDay = Boolean(event.start?.date && !event.start?.dateTime),
    startValue =
      event.start?.dateTime ||
      `${event.start?.date || dateKey(0)}T00:00:00+02:00`,
    endValue = event.end?.dateTime || startValue,
    start = new Date(startValue),
    end = new Date(endValue),
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(start),
    part = (type: string) =>
      parts.find((value) => value.type === type)?.value || "",
    endParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(end),
    endPart = (type: string) =>
      endParts.find((value) => value.type === type)?.value || "",
    minutes = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / 60000),
    ),
    description = String(event.description || ""),
    link = event.hangoutLink || description.match(/https?:\/\/\S+/)?.[0] || "",
    googleEndDate = `${endPart("year")}-${endPart("month")}-${endPart("day")}`,
    inclusiveEndDate = (() => {
      if (!allDay) return googleEndDate;
      const value = new Date(`${googleEndDate}T12:00:00`);
      value.setDate(value.getDate() - 1);
      return value.toLocaleDateString("en-CA");
    })();
  return {
    id: `google:${event.id}`,
    googleEventId: event.id,
    googleOnly: true,
    calendarAdded: true,
    title: event.summary || "Untitled appointment",
    place: event.location || "Location to be confirmed",
    date: `${part("year")}-${part("month")}-${part("day")}`,
    endDate: inclusiveEndDate,
    time: allDay ? "" : `${part("hour")}:${part("minute")}`,
    endTime: allDay ? "" : `${endPart("hour")}:${endPart("minute")}`,
    allDay,
    duration: `${minutes || 60} minutes`,
    meetingLink: link,
  };
}
function renewalContactDate(leaseEndDate: string) {
  const d = new Date(`${leaseEndDate}T12:00:00`);
  d.setMonth(d.getMonth() - 3);
  return d.toLocaleDateString("en-CA");
}
function daysUntil(date: string) {
  return Math.ceil(
    (new Date(`${date}T12:00:00`).getTime() -
      new Date(`${dateKey(0)}T12:00:00`).getTime()) /
      86400000,
  );
}
function numberedStep(stages: string[], index: number) {
  return `Step ${index + 1} — ${stages[index]}`;
}
function workflowIndex(stages: string[], stage: string) {
  const clean = stage.replace(/^Completed: /, "").replace(/^Step \d+ — /, ""),
    index = stages.findIndex((s) => s === clean);
  return index < 0 ? 0 : index;
}
function workflowComplete(stages: string[], stage: string) {
  return (
    workflowIndex(stages, stage) === stages.length - 1 &&
    stage.startsWith("Completed:")
  );
}
function renewalCompletedActions(item: LeaseRenewal) {
  if (item.completedActions) return item.completedActions;
  return workflowComplete(renewalStages, item.stage)
    ? renewalActions.filter(
        (action) => action !== "Awaiting documents if FICA has changed",
      )
    : [];
}
function renewalComplete(item: LeaseRenewal) {
  return (
    Boolean(item.archived) ||
    (!item.completedActions && workflowComplete(renewalStages, item.stage))
  );
}
function newLeaseCompletedActions(item: NewLease) {
  if (item.completedActions) return item.completedActions;
  const index = workflowIndex(newLeaseStages, item.stage);
  return workflowComplete(newLeaseStages, item.stage)
    ? newLeaseStages
    : newLeaseStages.slice(0, index);
}
function newLeaseComplete(item: NewLease) {
  return newLeaseStages.every((action) =>
    newLeaseCompletedActions(item).includes(action),
  );
}
function addBusinessDays(from: string, count = 2) {
  const d = new Date(`${from}T12:00:00`);
  let added = 0;
  while (added < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toLocaleDateString("en-CA");
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}
function extractRenewalDetails(text: string) {
  const cleaned = text.replace(/\u00a0/g, " "),
    months: { [key: string]: string } = {
      january: "01",
      jan: "01",
      february: "02",
      feb: "02",
      march: "03",
      mar: "03",
      april: "04",
      apr: "04",
      may: "05",
      june: "06",
      jun: "06",
      july: "07",
      jul: "07",
      august: "08",
      aug: "08",
      september: "09",
      sep: "09",
      sept: "09",
      october: "10",
      oct: "10",
      november: "11",
      nov: "11",
      december: "12",
      dec: "12",
    };
  const labelled = cleaned.match(
      /(?:property(?:\s+address)?|address|premises|unit)\s*[:\-]\s*([^\n\r]+)/i,
    ),
    street = cleaned.match(
      /\b(?:unit\s+\d+[a-z]?\s*,?\s*)?\d+[a-z]?\s+[A-Za-zÀ-ÿ0-9.' -]+\s+(?:street|st|road|rd|avenue|ave|drive|dr|close|crescent|cres|lane|ln|way|boulevard|blvd)\b[^\n\r,]*/i,
    );
  const property = (labelled?.[1] || street?.[0] || "")
      .trim()
      .replace(/[.;,]+$/, ""),
    iso = cleaned.match(/\b(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/),
    local = cleaned.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})\b/),
    words = cleaned.match(
      /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sept|Sep|October|Oct|November|Nov|December|Dec)[,\s]+(20\d{2})\b/i,
    );
  let leaseEndDate = "";
  if (iso)
    leaseEndDate = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  else if (local)
    leaseEndDate = `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  else if (words)
    leaseEndDate = `${words[3]}-${months[words[2].toLowerCase()]}-${words[1].padStart(2, "0")}`;
  return { property, leaseEndDate };
}
function renewalDateFromText(text: string) {
  const months: { [key: string]: string } = {
      january: "01",
      jan: "01",
      february: "02",
      feb: "02",
      march: "03",
      mar: "03",
      april: "04",
      apr: "04",
      may: "05",
      june: "06",
      jun: "06",
      july: "07",
      jul: "07",
      august: "08",
      aug: "08",
      september: "09",
      sep: "09",
      sept: "09",
      october: "10",
      oct: "10",
      november: "11",
      nov: "11",
      december: "12",
      dec: "12",
    },
    iso = text.match(/\b(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/),
    local = text.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})\b/),
    words = text.match(
      /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sept|Sep|October|Oct|November|Nov|December|Dec)[,\s]+(20\d{2})\b/i,
    );
  if (iso)
    return {
      date: `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`,
      raw: iso[0],
    };
  if (local)
    return {
      date: `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`,
      raw: local[0],
    };
  if (words)
    return {
      date: `${words[3]}-${months[words[2].toLowerCase()]}-${words[1].padStart(2, "0")}`,
      raw: words[0],
    };
  return null;
}
function extractRenewalList(text: string, assigned: string) {
  const lines = text
      .replace(/\u00a0/g, " ")
      .split(/\r?\n/)
      .map((line) =>
        line
          .replace(/[|]+/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim(),
      )
      .filter(Boolean),
    rows: RenewalDraft[] = [];
  const cleanProperty = (value: string) =>
    value
      .replace(/\b(?:managed|procurement\s+only|mandate(?:\s+type)?)\b.*$/i, "")
      .replace(
        /(?:lease\s*)?(?:expiry|expiration|end)(?:\s*date)?\s*[:\-]?/gi,
        "",
      )
      .replace(/^(?:property|asset|address|premises)\s*:?\s*/i, "")
      .replace(/^[\s,:;\-–—]+|[\s,:;\-–—]+$/g, "")
      .trim();
  lines.forEach((line, index) => {
    const match = renewalDateFromText(line);
    if (!match) return;
    let property = cleanProperty(line.replace(match.raw, ""));
    if (!property || property.length < 3) {
      const previous = cleanProperty(lines[index - 1] || "");
      if (
        previous &&
        !renewalDateFromText(previous) &&
        !/asset|property|current lease|expiry|expiration|lease end|mandate/i.test(
          previous,
        )
      )
        property = previous;
    }
    if (property && property.length > 2)
      rows.push({
        id: Date.now() + index,
        property,
        leaseEndDate: match.date,
        assigned,
      });
  });
  const dates = lines
      .map((line) => renewalDateFromText(line))
      .filter(Boolean) as { date: string; raw: string }[],
    firstDateLine = lines.findIndex((line) =>
      Boolean(renewalDateFromText(line)),
    ),
    propertyCandidates = lines
      .slice(0, firstDateLine < 0 ? lines.length : firstDateLine)
      .map(cleanProperty)
      .filter(
        (line) =>
          line.length >= 3 &&
          line.length <= 100 &&
          /[A-Za-z]/.test(line) &&
          /\d/.test(line) &&
          !/\b(?:90|three|month|day|email|lease|expiry|current|mandate|managed|procurement)\b/i.test(
            line,
          ),
      );
  if (dates.length > rows.length && propertyCandidates.length >= dates.length) {
    const assets = propertyCandidates.slice(-dates.length),
      columnRows = dates.map((date, index) => ({
        id: Date.now() + 1000 + index,
        property: assets[index],
        leaseEndDate: date.date,
        assigned,
      }));
    if (columnRows.length > rows.length) return columnRows;
  }
  return rows.filter(
    (row, index) =>
      rows.findIndex(
        (item) =>
          item.property.toLowerCase() === row.property.toLowerCase() &&
          item.leaseEndDate === row.leaseEndDate,
      ) === index,
  );
}
async function prepareRenewalOcrImage(file: File) {
  const bitmap = await createImageBitmap(file),
    maximumWidth = 2400,
    scale = Math.min(2.5, maximumWidth / bitmap.width),
    width = Math.max(1, Math.round(bitmap.width * scale)),
    height = Math.max(1, Math.round(bitmap.height * scale)),
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    return file;
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = "grayscale(1) contrast(1.65) brightness(1.08) blur(0.25px)";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.94),
  );
}
function QuickAddMenu({
  onTask,
  onAppointment,
  onNewLease,
  onRenewal,
  onMaintenance,
}: any) {
  const choose = (event: any, action: () => void) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
    action();
  };
  return (
    <details className="quick-add">
      <summary>
        Create new
        <ChevronDown />
      </summary>
      <div className="quick-add-menu">
        <button onClick={(e) => choose(e, onTask)}>
          <ListTodo />
          <span>
            <b>Task</b>
            <small>Add a task or reminder</small>
          </span>
        </button>
        <button onClick={(e) => choose(e, onAppointment)}>
          <CalendarDays />
          <span>
            <b>Meeting / appointment</b>
            <small>Add to your calendar</small>
          </span>
        </button>
        <button onClick={(e) => choose(e, onNewLease)}>
          <Building2 />
          <span>
            <b>New lease</b>
            <small>Start a new lease checklist</small>
          </span>
        </button>
        <button onClick={(e) => choose(e, onRenewal)}>
          <FileText />
          <span>
            <b>Lease renewal</b>
            <small>Add an upcoming renewal</small>
          </span>
        </button>
        <button onClick={(e) => choose(e, onMaintenance)}>
          <Wrench />
          <span>
            <b>Maintenance issue</b>
            <small>Log a property issue</small>
          </span>
        </button>
      </div>
    </details>
  );
}
function AccessPicker({ form, setForm, users }: any) {
  const choices = users.filter((user: User) => user.profileId && user.short !== (form.assignee || form.assigned));
  if (!choices.length) return null;
  return <fieldset className="profile-link-field assistant-access-field" style={{ gridColumn: "1 / -1", padding: 15, border: "1px solid #cfddd8", borderRadius: 12 }}>
    <legend>Give access to</legend>
    <small>Selected connected staff can see this item and its status updates. This does not give access to your full profile.</small>
    {choices.map((user: User) => <label className="assistant-access-option" key={user.profileId}>
      <input type="checkbox" checked={(form.sharedWithProfileIds || []).includes(user.profileId!)} onChange={(event) => setForm({
        ...form,
        sharedWithProfileIds: event.target.checked
          ? [...(form.sharedWithProfileIds || []), user.profileId]
          : (form.sharedWithProfileIds || []).filter((id: string) => id !== user.profileId),
      })} />
      <span>{user.name}</span>
    </label>)}
  </fieldset>;
}
function TaskColourPicker({ form, setForm, colours, onRename }: any) {
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    setDraftLabels(Object.fromEntries((colours || []).map((colour: TaskColour) => [colour.key, colour.label])));
  }, [colours]);
  const commitLabel = (colour: TaskColour) => {
    const label = (draftLabels[colour.key] || "").trim() || colour.label;
    setDraftLabels((all) => ({ ...all, [colour.key]: label }));
    onRename(colour.key, label);
    if (form.colourKey === colour.key) setForm({ ...form, colourLabel: label });
  };
  return <fieldset className="task-colour-picker">
    <legend>Task colour</legend>
    <small>Choose a pastel colour. You can rename each colour to suit your family, personal or work reminders.</small>
    <div className="task-colour-options">
      {colours.map((colour: TaskColour) => <div className={`task-colour-option ${form.colourKey === colour.key ? "selected" : ""}`} key={colour.key}>
        <button type="button" aria-label={`Use ${colour.label}`} style={{ background: colour.hex, borderColor: form.colourKey === colour.key ? colour.accent : "transparent" }} onClick={() => setForm({ ...form, colourKey: colour.key, colourLabel: draftLabels[colour.key] || colour.label, colourHex: colour.hex, colourAccent: colour.accent })}>
          {form.colourKey === colour.key && <Check />}
        </button>
        <input value={draftLabels[colour.key] ?? colour.label} aria-label={`Rename ${colour.key} colour`} onChange={(event) => setDraftLabels((all) => ({ ...all, [colour.key]: event.target.value }))} onBlur={() => commitLabel(colour)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
      </div>)}
    </div>
    <style>{`
      .task-colour-picker{grid-column:1/-1;padding:14px;border:1px solid #cfddd8;border-radius:12px}.task-colour-picker legend{padding:0 6px;font-size:12px;font-weight:850;color:#174b3e}.task-colour-picker>small{display:block;margin-bottom:10px;color:#71817c;font-size:10px;line-height:1.45}.task-colour-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.task-colour-option{min-width:0}.task-colour-option button{width:100%;height:38px;border:2px solid transparent;border-radius:10px;display:grid;place-items:center}.task-colour-option.selected button{border-color:#075d4b;box-shadow:0 0 0 2px #fff inset}.task-colour-option button svg{width:16px;height:16px;color:#16483c}.task-colour-option input{width:100%;margin-top:6px;padding:6px!important;border-radius:7px!important;font-size:9px!important;text-align:center}.task-colour-badge{display:inline-flex;align-items:center;width:max-content;padding:4px 8px;border:1px solid rgba(23,75,62,.12);border-radius:999px;color:#294d43;font-size:9px;font-weight:800;font-style:normal}@media(max-width:620px){.task-colour-options{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `}</style>
  </fieldset>;
}
function CategoryTag({ label, colour, accent }: { label?: string; colour?: string; accent?: string }) {
  if (!label) return null;
  return <span className="personal-category-tag" style={{ background: colour || "#eef1ef", "--category-dot": accent || "#718f84" } as any}><i />{label}</span>;
}
function TaskDialog({ dialog, setDialog, form, setForm, addTask, users, colours, onRenameColour }: any) {
  return (
    <Dialog open={dialog} onOpenChange={setDialog}>
      <DialogTrigger asChild>
        <Button className="add-button">
          <Plus />
          Add task
        </Button>
      </DialogTrigger>
      <DialogContent className="task-dialog compact-property-dialog compact-task-dialog">
        <DialogHeader>
          <DialogTitle>Create a task</DialogTitle>
          <DialogDescription>
            Assign the task to yourself or the other person connected to your
            profile.
          </DialogDescription>
        </DialogHeader>
        <div className="form-grid">
          <label>
            Task
            <input
              autoFocus
              value={form.title}
              onChange={(e: any) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Follow up tenant application"
            />
          </label>
          <label>
            Property
            <input
              value={form.property}
              onChange={(e: any) =>
                setForm({ ...form, property: e.target.value })
              }
              placeholder="Address or property name"
            />
          </label>
          <label className="notes-field">
            Task notes
            <textarea
              value={form.notes}
              onChange={(e: any) => setForm({ ...form, notes: e.target.value })}
              placeholder="Add instructions, contact details or follow-up notes..."
            />
          </label>
          <label>
            Assign to
            <select
              value={form.assignee}
              onChange={(e: any) =>
                setForm({ ...form, assignee: e.target.value })
              }
            >
              {users.map((u: User) => (
                <option key={u.name} value={u.short}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input
              type="date"
              value={form.due}
              onChange={(e: any) => setForm({ ...form, due: e.target.value })}
            />
          </label>
          <label>
            Time
            <input
              type="time"
              value={form.time}
              onChange={(e: any) => setForm({ ...form, time: e.target.value })}
            />
          </label>
          <label>
            Priority
            <select
              value={form.priority}
              onChange={(e: any) =>
                setForm({ ...form, priority: e.target.value })
              }
            >
              <option>Normal</option>
              <option>Low</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </label>
          <TaskColourPicker form={form} setForm={setForm} colours={colours} onRename={onRenameColour} />
          <AccessPicker form={form} setForm={setForm} users={users} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialog(false)}>
            Cancel
          </Button>
          <Button className="add-button" onClick={addTask}>
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function AppointmentDialog({
  open,
  setOpen,
  form,
  setForm,
  addAppointment,
  showTrigger = true,
  colours,
  onRenameColour,
}: any) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button className="add-button">
            <Plus />
            Add appointment
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="task-dialog appointment-dialog">
        <DialogHeader>
          <DialogTitle>Add a meeting or appointment</DialogTitle>
          <DialogDescription>
            Choose the exact date and add it to Google Calendar.
          </DialogDescription>
        </DialogHeader>
        <div className="form-grid appointment-form">
          <label>
            Meeting or appointment
            <input
              autoFocus
              value={form.title}
              onChange={(e: any) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Tenant viewing"
            />
          </label>
          <label>
            Location or property
            <input
              value={form.place}
              onChange={(e: any) => setForm({ ...form, place: e.target.value })}
              placeholder="Address, office or online"
            />
          </label>
          <label className="appointment-start-date">
            From date
            <input
              type="date"
              value={form.date}
              min={dateKey(0)}
              onChange={(e: any) =>
                setForm({
                  ...form,
                  date: e.target.value,
                  endDate:
                    form.endDate < e.target.value
                      ? e.target.value
                      : form.endDate,
                })
              }
            />
          </label>
          <label className="appointment-end-date">
            To date
            <input
              type="date"
              value={form.endDate}
              min={form.date}
              onChange={(e: any) =>
                setForm({ ...form, endDate: e.target.value })
              }
            />
          </label>
          <label className="all-day-field">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e: any) =>
                setForm({ ...form, allDay: e.target.checked })
              }
            />
            Whole day
          </label>
          {!form.allDay && (
            <>
              <label className="appointment-start-time">
                From time
                <input
                  type="time"
                  value={form.time}
                  onChange={(e: any) =>
                    setForm({ ...form, time: e.target.value })
                  }
                />
              </label>
              <label className="appointment-end-time">
                To time
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e: any) =>
                    setForm({ ...form, endTime: e.target.value })
                  }
                />
              </label>
            </>
          )}
          <label className="meeting-link-field">
            Zoom or Microsoft Teams link
            <input
              type="url"
              value={form.meetingLink}
              onChange={(e: any) =>
                setForm({ ...form, meetingLink: e.target.value })
              }
              placeholder="https://zoom.us/... or https://teams.microsoft.com/..."
            />
          </label>
          <TaskColourPicker form={form} setForm={setForm} colours={colours} onRename={onRenameColour} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="add-button" onClick={addAppointment}>
            Add to Google Calendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function AppointmentEditDialog({
  appointment,
  setAppointment,
  save,
  remove,
  colours,
  onRenameColour,
}: any) {
  return (
    <Dialog
      open={!!appointment}
      onOpenChange={(open) => !open && setAppointment(null)}
    >
      <DialogContent className="task-dialog appointment-dialog">
        <DialogHeader>
          <DialogTitle>Edit meeting or appointment</DialogTitle>
          <DialogDescription>
            Change the date, time, location or online meeting link.
          </DialogDescription>
        </DialogHeader>
        {appointment && (
          <div className="form-grid appointment-form">
            <label>
              Meeting or appointment
              <input
                autoFocus
                value={appointment.title}
                onChange={(e) =>
                  setAppointment({ ...appointment, title: e.target.value })
                }
              />
            </label>
            <label>
              Location or property
              <input
                value={appointment.place}
                onChange={(e) =>
                  setAppointment({ ...appointment, place: e.target.value })
                }
              />
            </label>
            <label className="appointment-start-date">
              From date
              <input
                type="date"
                value={appointment.date}
                onChange={(e) =>
                  setAppointment({
                    ...appointment,
                    date: e.target.value,
                    endDate:
                      (appointment.endDate || appointment.date) < e.target.value
                        ? e.target.value
                        : appointment.endDate || appointment.date,
                  })
                }
              />
            </label>
            <label className="appointment-end-date">
              To date
              <input
                type="date"
                value={appointment.endDate || appointment.date}
                min={appointment.date}
                onChange={(e) =>
                  setAppointment({ ...appointment, endDate: e.target.value })
                }
              />
            </label>
            <label className="all-day-field">
              <input
                type="checkbox"
                checked={Boolean(appointment.allDay)}
                onChange={(e) =>
                  setAppointment({
                    ...appointment,
                    allDay: e.target.checked,
                  })
                }
              />
              Whole day
            </label>
            {!appointment.allDay && (
              <>
                <label className="appointment-start-time">
                  From time
                  <input
                    type="time"
                    value={appointment.time}
                    onChange={(e) =>
                      setAppointment({ ...appointment, time: e.target.value })
                    }
                  />
                </label>
                <label className="appointment-end-time">
                  To time
                  <input
                    type="time"
                    value={appointment.endTime || ""}
                    onChange={(e) =>
                      setAppointment({
                        ...appointment,
                        endTime: e.target.value,
                      })
                    }
                  />
                </label>
              </>
            )}
            <label className="meeting-link-field">
              Zoom or Microsoft Teams link
              <input
                type="url"
                value={appointment.meetingLink || ""}
                onChange={(e) =>
                  setAppointment({
                    ...appointment,
                    meetingLink: e.target.value,
                  })
                }
              />
            </label>
            <TaskColourPicker form={appointment} setForm={setAppointment} colours={colours} onRename={onRenameColour} />
          </div>
        )}
        <DialogFooter className="appointment-edit-footer">
          <Button
            className="dialog-delete"
            onClick={() => appointment && remove(appointment.id)}
          >
            Delete
          </Button>
          <span />
          <Button variant="outline" onClick={() => setAppointment(null)}>
            Cancel
          </Button>
          <Button className="add-button" onClick={save}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function RenewalDialog({
  open,
  setOpen,
  form,
  setForm,
  addRenewal,
  users,
}: any) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="renewal-entry-overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <section
        className="renewal-entry-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="renewal-entry-title"
      >
        <button
          type="button"
          className="renewal-entry-close"
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
        <header>
          <h2 id="renewal-entry-title">Add lease renewal</h2>
          <p>Enter the property and lease expiry details manually.</p>
        </header>
        <div className="form-grid renewal-manual-form">
          <label className="renewal-property-field">
            Property name or address
            <input
              autoFocus
              value={form.property}
              onChange={(e: any) =>
                setForm({ ...form, property: e.target.value })
              }
              placeholder="Property name or address"
            />
          </label>
          <label>
            Lease expiry date
            <input
              type="date"
              value={form.leaseEndDate}
              onChange={(e: any) =>
                setForm({ ...form, leaseEndDate: e.target.value })
              }
            />
          </label>
          <label>
            Assigned to
            <select
              value={form.assigned}
              onChange={(e: any) =>
                setForm({ ...form, assigned: e.target.value })
              }
            >
              {users.map((u: User) => (
                <option key={u.name} value={u.short}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="notes-field">
            Notes (optional)
            <textarea
              value={form.emailText}
              onChange={(e: any) =>
                setForm({ ...form, emailText: e.target.value })
              }
              placeholder="Add any renewal notes here..."
            />
          </label>
          <AccessPicker form={form} setForm={setForm} users={users} />
        </div>
        <footer className="renewal-entry-actions">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="add-button"
            disabled={!form.property.trim() || !form.leaseEndDate}
            onClick={addRenewal}
          >
            Save renewal
          </Button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
function TaskRows({
  items,
  setTasks,
  onStatusChange,
  colours = DEFAULT_TASK_COLOURS,
  onRenameColour = () => undefined,
}: {
  items: Task[];
  setTasks: any;
  onStatusChange?: (task: Task, done: boolean) => void;
  colours?: TaskColour[];
  onRenameColour?: (key: string, label: string) => void;
}) {
  const [menuId, setMenuId] = useState<number | null>(null),
    [editing, setEditing] = useState<Task | null>(null);
  const toggleTask = (task: Task) => {
    const done = !task.done,
      now = new Date().toISOString();
    setTasks((ts: Task[]) =>
      ts.map((t) =>
        t.id === task.id
          ? {
              ...t,
              done,
              completedAt: done ? now : undefined,
              archived: done,
              archivedAt: done ? now : undefined,
            }
          : t,
      ),
    );
    onStatusChange?.(task, done);
  };
  const saveEdit = () => {
    if (!editing) return;
    setTasks((ts: Task[]) =>
      ts.map((t) => (t.id === editing.id ? editing : t)),
    );
    setEditing(null);
  };
  return (
    <>
      <div className="task-list">
        {items.length ? (
          items.map((task) => (
            <article
              key={task.id}
              className={`${task.done ? "done" : ""} ${taskDisplayPriority(task)}`}
            >
              <Checkbox
                checked={task.done}
                onCheckedChange={() => toggleTask(task)}
              />
              <div className="task-copy">
                <div className="task-top">
                  <h3>{task.title}</h3>
                  <span className={`priority ${taskDisplayPriority(task)}`}>
                    {taskDueState(task.due) === "Overdue"
                      ? "Urgent · overdue"
                      : task.priority}
                  </span>
                </div>
                <p>
                  <Building2 />
                  {task.property}
                </p>
                {task.notes && <p className="task-notes">{task.notes}</p>}
                <CategoryTag label={task.colourLabel} colour={task.colourHex} accent={task.colourAccent} />
                <div className="task-meta">
                  <span className="person-pill">
                    {task.assignee.slice(0, 1)} · {task.assignee}
                  </span>
                  <span
                    className={
                      taskDueState(task.due) === "Overdue" ? "overdue" : ""
                    }
                  >
                    <CalendarDays />
                    {taskDueLabel(task.due)}
                  </span>
                  <span>
                    <Clock3 />
                    {task.time}
                  </span>
                </div>
              </div>
              <button
                className="more"
                aria-label={`Actions for ${task.title}`}
                onClick={() => setMenuId(menuId === task.id ? null : task.id)}
              >
                •••
              </button>
              {menuId === task.id && (
                <div className="task-action-menu">
                  <button
                    onClick={() => {
                      toggleTask(task);
                      setMenuId(null);
                    }}
                  >
                    {task.done ? "Reopen task" : "Mark completed"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing({ ...task });
                      setMenuId(null);
                    }}
                  >
                    Edit task
                  </button>
                  <button
                    className="delete-action"
                    onClick={() => {
                      if (window.confirm("Delete this task?"))
                        setTasks((ts: Task[]) =>
                          ts.filter((t) => t.id !== task.id),
                        );
                      setMenuId(null);
                    }}
                  >
                    Delete task
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <Check />
            <h3>All clear</h3>
            <p>No tasks need attention in this view.</p>
          </div>
        )}
      </div>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="task-dialog">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>
              Update the task details and save your changes.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="form-grid">
              <label>
                Task
                <input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </label>
              <label>
                Property
                <input
                  value={editing.property}
                  onChange={(e) =>
                    setEditing({ ...editing, property: e.target.value })
                  }
                />
              </label>
              <label className="notes-field">
                Task notes
                <textarea
                  value={editing.notes || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, notes: e.target.value })
                  }
                />
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={taskDateInputValue(editing.due)}
                  onChange={(e) =>
                    setEditing({ ...editing, due: e.target.value })
                  }
                />
              </label>
              <TaskColourPicker form={editing} setForm={setEditing} colours={colours} onRename={onRenameColour} />
              <label>
                Time
                <input
                  type="time"
                  value={editing.time}
                  onChange={(e) =>
                    setEditing({ ...editing, time: e.target.value })
                  }
                />
              </label>
              <label>
                Priority
                <select
                  value={editing.priority}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      priority: e.target.value as Priority,
                    })
                  }
                >
                  <option>Normal</option>
                  <option>Low</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button className="add-button" onClick={saveEdit}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function TodayLeaseOverview({
  renewals,
  newLeases,
  setActive,
  manager,
  current,
  profileAssignees,
}: any) {
  const rs = (
      manager
        ? renewals
        : renewals.filter((r: LeaseRenewal) =>
            (profileAssignees.includes(r.assigned) || Boolean(current?.profileId && r.sharedWithProfileIds?.includes(current.profileId))),
          )
    ).filter((r: LeaseRenewal) => !renewalComplete(r)),
    ls = (
      manager
        ? newLeases
        : newLeases.filter((l: NewLease) =>
            (profileAssignees.includes(l.assigned) || Boolean(current?.profileId && l.sharedWithProfileIds?.includes(current.profileId))),
          )
    ).filter((l: NewLease) => !workflowComplete(newLeaseStages, l.stage)),
    renewalUrgent = rs.filter(
      (r: LeaseRenewal) => daysUntil(r.leaseEndDate) <= 31,
    ).length,
    leaseUrgent = ls.filter(
      (l: NewLease) => daysUntil(l.occupationDate) <= 14,
    ).length;
  return (
    <section className="today-lease-overview">
      <div className="panel-heading">
        <div>
          <h2>Lease renewals and new leases</h2>
          <p>Tick off renewal actions as they are completed</p>
        </div>
      </div>
      <div className="today-lease-grid">
        <article className={renewalUrgent ? "urgent" : ""}>
          <FileText />
          <div>
            <small>LEASE RENEWALS</small>
            <strong>{rs.length} active</strong>
            <span>
              {renewalUrgent
                ? `${renewalUrgent} very urgent`
                : `${rs.filter((r: LeaseRenewal) => r.nextFollowUpDate <= dateKey(0)).length} follow-ups due`}
            </span>
          </div>
          <Button variant="outline" onClick={() => setActive("Lease Renewals")}>
            Update
          </Button>
        </article>
        <article className={leaseUrgent ? "urgent" : ""}>
          <Building2 />
          <div>
            <small>NEW LEASES</small>
            <strong>{ls.length} active</strong>
            <span>
              {leaseUrgent
                ? `${leaseUrgent} very urgent`
                : `${ls.filter((l: NewLease) => l.nextFollowUpDate <= dateKey(0)).length} follow-ups due`}
            </span>
          </div>
          <Button variant="outline" onClick={() => setActive("New Leases")}>
            Update
          </Button>
        </article>
      </div>
    </section>
  );
}
function Today({
  visible,
  manager,
  current,
  profileAssignees,
  maintenance,
  appointments,
  renewals,
  newLeases,
  setActive,
}: any) {
  return (
    <TodayOverviewDetailed
      tasks={visible}
      manager={manager}
      current={current}
      profileAssignees={profileAssignees}
      maintenance={maintenance}
      appointments={appointments}
      renewals={renewals}
      newLeases={newLeases}
      setActive={setActive}
    />
  );
}

function TodayOverviewDetailed({
  tasks,
  manager,
  current,
  profileAssignees,
  maintenance,
  appointments,
  renewals,
  newLeases,
  setActive,
}: any) {
  const nowTime = new Date().toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    own = (assigned: string) => manager || profileAssignees.includes(assigned),
    openTasks = tasks
      .filter((item: Task) => !item.archived && !item.done)
      .sort((a: Task, b: Task) => taskUrgencyRank(a) - taskUrgencyRank(b)),
    todayMeetings = appointments
      .filter(
        (item: Appointment) =>
          (item.date === dateKey(0) || item.date === "Today") &&
          (!item.time || item.time >= nowTime),
      )
      .sort((a: Appointment, b: Appointment) => a.time.localeCompare(b.time)),
    openMaintenance = maintenance
      .filter(
        (item: Maintenance) =>
          own(item.assigned) && !item.archived && item.status !== "Completed",
      )
      .sort(
        (a: Maintenance, b: Maintenance) =>
          Number(b.priority === "Urgent") - Number(a.priority === "Urgent"),
      ),
    openRenewals = renewals
      .filter(
        (item: LeaseRenewal) => own(item.assigned) && !renewalComplete(item),
      )
      .sort((a: LeaseRenewal, b: LeaseRenewal) =>
        a.leaseEndDate.localeCompare(b.leaseEndDate),
      ),
    openLeases = newLeases
      .filter((item: NewLease) => own(item.assigned) && !newLeaseComplete(item))
      .sort((a: NewLease, b: NewLease) =>
        a.occupationDate.localeCompare(b.occupationDate),
      );
  const sections = [
    {
      title: "Today’s calendar",
      subtitle: "Upcoming meetings and appointments",
      section: "Appointments",
      icon: CalendarDays,
      items: todayMeetings.map((item: Appointment) => ({
        title: item.title,
        meta: [item.time, item.place].filter(Boolean).join(" · "),
        colourHex: item.colourHex,
        colourAccent: item.colourAccent,
        colourLabel: item.colourLabel,
      })),
      empty: "No upcoming meetings today",
    },
    {
      title: "Your tasks",
      subtitle: "Outstanding work requiring attention",
      section: "Tasks & To-do",
      icon: ListTodo,
      items: openTasks.map((item: Task) => ({
        title: item.title,
        meta: [item.property, taskDueLabel(item.due), item.time]
          .filter(Boolean)
          .join(" · "),
        priority: taskDisplayPriority(item),
        urgent:
          item.priority === "Urgent" || taskDueState(item.due) === "Overdue",
        colourHex: item.colourHex,
        colourAccent: item.colourAccent,
        colourLabel: item.colourLabel,
      })),
      empty: "No outstanding tasks",
    },
    {
      title: "Maintenance",
      subtitle: "Outstanding property issues",
      section: "Maintenance",
      icon: Wrench,
      items: openMaintenance.map((item: Maintenance) => ({
        title: item.issue,
        meta: [item.property, item.status].filter(Boolean).join(" · "),
        urgent: item.priority === "Urgent",
      })),
      empty: "No outstanding maintenance",
    },
    {
      title: "Lease renewals",
      subtitle: "Renewals currently in progress",
      section: "Lease Renewals",
      icon: FileText,
      items: openRenewals.map((item: LeaseRenewal) => ({
        title: item.property,
        meta: `Expires ${formatDate(item.leaseEndDate)}`,
        urgent: daysUntil(item.leaseEndDate) <= 31,
      })),
      empty: "No active lease renewals",
    },
    {
      title: "New leases",
      subtitle: "New leases currently in progress",
      section: "New Leases",
      icon: Building2,
      items: openLeases.map((item: NewLease) => ({
        title: item.property,
        meta: `Starts ${formatDate(item.occupationDate)}`,
        urgent: daysUntil(item.occupationDate) <= 14,
      })),
      empty: "No active new leases",
    },
  ];
  return (
    <div className="today-detail-overview">
      {sections.map(
        ({ title, subtitle, section, icon: Icon, items, empty }) => (
          <section className="today-detail-section" key={section}>
            <button
              className="today-detail-heading"
              onClick={() => setActive(section)}
            >
              <span>
                <Icon />
              </span>
              <div>
                <h2>{title}</h2>
                <p>{subtitle}</p>
              </div>
              <ArrowRight />
            </button>
            <div className="today-detail-list">
              {items.length ? (
                items.map((item: any, index: number) => (
                  <button
                    key={`${item.title}-${index}`}
                    className={`${item.priority || ""} ${item.urgent ? "urgent" : ""} ${section === "Appointments" && item.colourHex ? "category-calendar-item" : ""}`.trim()}
                    style={section === "Appointments" && item.colourHex ? { background: `linear-gradient(90deg, ${item.colourHex} 0%, #ffffff 78%)`, "--category-accent": item.colourAccent || "#718f84" } as any : undefined}
                    onClick={() => setActive(section)}
                  >
                    <i />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.meta}</small>
                      <CategoryTag label={item.colourLabel} colour={item.colourHex} accent={item.colourAccent} />
                    </span>
                    <ChevronDown />
                  </button>
                ))
              ) : (
                <p className="today-detail-empty">
                  <Check />
                  {empty}
                </p>
              )}
            </div>
          </section>
        ),
      )}
    </div>
  );
}

function TodayOverview({
  tasks,
  manager,
  current,
  profileAssignees,
  maintenance,
  appointments,
  renewals,
  newLeases,
  setActive,
}: any) {
  const nowTime = new Date().toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    own = (assigned: string) => manager || profileAssignees.includes(assigned),
    openTasks = tasks.filter((task: Task) => !task.archived && !task.done),
    todayMeetings = appointments.filter(
      (item: Appointment) =>
        (item.date === dateKey(0) || item.date === "Today") &&
        (!item.time || item.time >= nowTime),
    ),
    openMaintenance = maintenance.filter(
      (item: Maintenance) =>
        own(item.assigned) && !item.archived && item.status !== "Completed",
    ),
    openRenewals = renewals
      .filter(
        (item: LeaseRenewal) => own(item.assigned) && !renewalComplete(item),
      )
      .sort((a: LeaseRenewal, b: LeaseRenewal) =>
        a.leaseEndDate.localeCompare(b.leaseEndDate),
      ),
    openLeases = newLeases
      .filter((item: NewLease) => own(item.assigned) && !newLeaseComplete(item))
      .sort((a: NewLease, b: NewLease) =>
        a.occupationDate.localeCompare(b.occupationDate),
      );
  const cards = [
    {
      label: "Your tasks",
      count: openTasks.length,
      detail:
        openTasks
          .slice(0, 2)
          .map((item: Task) => item.title)
          .join(" · ") || "No outstanding tasks",
      section: "Tasks & To-do",
      icon: ListTodo,
      tone: openTasks.some(
        (item: Task) =>
          item.priority === "Urgent" || taskDueState(item.due) === "Overdue",
      )
        ? "urgent"
        : "",
    },
    {
      label: "Today’s meetings",
      count: todayMeetings.length,
      detail:
        todayMeetings
          .slice(0, 2)
          .map((item: Appointment) => `${item.time || ""} ${item.title}`.trim())
          .join(" · ") || "No upcoming meetings today",
      section: "Appointments",
      icon: CalendarDays,
      tone: "",
    },
    {
      label: "Outstanding maintenance",
      count: openMaintenance.length,
      detail:
        openMaintenance
          .slice(0, 2)
          .map((item: Maintenance) => item.issue)
          .join(" · ") || "No outstanding maintenance",
      section: "Maintenance",
      icon: Wrench,
      tone: openMaintenance.some(
        (item: Maintenance) => item.priority === "Urgent",
      )
        ? "urgent"
        : "",
    },
    {
      label: "Lease renewals",
      count: openRenewals.length,
      detail:
        openRenewals
          .slice(0, 2)
          .map(
            (item: LeaseRenewal) =>
              `${item.property} · ${formatDate(item.leaseEndDate)}`,
          )
          .join(" · ") || "No upcoming renewals",
      section: "Lease Renewals",
      icon: FileText,
      tone: "",
    },
    {
      label: "New leases",
      count: openLeases.length,
      detail:
        openLeases
          .slice(0, 2)
          .map(
            (item: NewLease) =>
              `${item.property} · ${formatDate(item.occupationDate)}`,
          )
          .join(" · ") || "No active new leases",
      section: "New Leases",
      icon: Building2,
      tone: "",
    },
  ];
  return (
    <section className="today-overview">
      <div className="today-overview-intro">
        <span>DAILY OVERVIEW</span>
        <h2>Good morning, {current.short}</h2>
        <p>Everything needing your attention in one place.</p>
      </div>
      <div className="today-overview-grid">
        {cards.map(({ label, count, detail, section, icon: Icon, tone }) => (
          <button
            key={section}
            className={tone}
            onClick={() => setActive(section)}
          >
            <span className="overview-icon">
              <Icon />
            </span>
            <span className="overview-copy">
              <small>{label}</small>
              <strong>{count}</strong>
              <em>{detail}</em>
            </span>
            <ArrowRight />
          </button>
        ))}
      </div>
    </section>
  );
}

function MorningBriefing({
  current,
  manager,
  tasks,
  maintenance,
  appointments,
  renewals,
  newLeases,
  profileAssignees,
  setActive,
}: any) {
  const scopedMaintenance = (
      manager
        ? maintenance
        : maintenance.filter((m: Maintenance) =>
            (profileAssignees.includes(m.assigned) || Boolean(current?.profileId && m.sharedWithProfileIds?.includes(current.profileId))),
          )
    ).filter((m: Maintenance) => !m.archived && m.status !== "Completed"),
    scopedRenewals = (
      manager
        ? renewals
        : renewals.filter((r: LeaseRenewal) =>
            (profileAssignees.includes(r.assigned) || Boolean(current?.profileId && r.sharedWithProfileIds?.includes(current.profileId))),
          )
    ).filter((r: LeaseRenewal) => !renewalComplete(r)),
    scopedLeases = (
      manager
        ? newLeases
        : newLeases.filter((l: NewLease) =>
            (profileAssignees.includes(l.assigned) || Boolean(current?.profileId && l.sharedWithProfileIds?.includes(current.profileId))),
          )
    ).filter((l: NewLease) => !workflowComplete(newLeaseStages, l.stage));
  const todayMeetings = appointments.filter(
      (a: Appointment) => a.date === dateKey(0) || a.date === "Today",
    ).length,
    priorityTasks = tasks.filter(
      (t: Task) =>
        !t.done &&
        (t.priority === "Urgent" ||
          ["Today", "Overdue"].includes(taskDueState(t.due))),
    ),
    urgentMaintenance = scopedMaintenance.filter(
      (m: Maintenance) => m.priority === "Urgent",
    ).length,
    urgentRenewals = scopedRenewals.filter(
      (r: LeaseRenewal) =>
        daysUntil(r.leaseEndDate) <= 31 || r.nextFollowUpDate <= dateKey(0),
    ).length,
    urgentLeases = scopedLeases.filter(
      (l: NewLease) =>
        daysUntil(l.occupationDate) <= 14 || l.nextFollowUpDate <= dateKey(0),
    ).length,
    totalAttention =
      priorityTasks.length + urgentMaintenance + urgentRenewals + urgentLeases;
  const firstName = current?.short || "there",
    summary = totalAttention
      ? `You have ${priorityTasks.length} priority task${priorityTasks.length === 1 ? "" : "s"}, ${todayMeetings} meeting${todayMeetings === 1 ? "" : "s"} and ${totalAttention - priorityTasks.length} workflow item${totalAttention - priorityTasks.length === 1 ? "" : "s"} needing attention.`
      : `You have ${todayMeetings} meeting${todayMeetings === 1 ? "" : "s"} today and no urgent workflow items.`;
  const nextAction = priorityTasks[0]
    ? {
        label: priorityTasks[0].title,
        detail: priorityTasks[0].property,
        section: "Tasks & To-do",
      }
    : urgentRenewals
      ? {
          label: "Follow up a lease renewal",
          detail: `${urgentRenewals} renewal${urgentRenewals === 1 ? "" : "s"} due for attention`,
          section: "Lease Renewals",
        }
      : urgentLeases
        ? {
            label: "Progress a new lease",
            detail: `${urgentLeases} lease${urgentLeases === 1 ? "" : "s"} due for attention`,
            section: "New Leases",
          }
        : urgentMaintenance
          ? {
              label: "Resolve urgent maintenance",
              detail: `${urgentMaintenance} urgent issue${urgentMaintenance === 1 ? "" : "s"}`,
              section: "Maintenance",
            }
          : null;
  return (
    <section className="morning-briefing">
      <div className="briefing-copy">
        <span className="briefing-kicker">
          <Sparkles /> DAILY BRIEFING
        </span>
        <h2>
          Good {dayPart()}, {firstName}
        </h2>
        <p>{summary}</p>
        <div className="briefing-actions">
          <Button
            onClick={() =>
              document
                .getElementById("today-priorities")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Start my day <ArrowRight />
          </Button>
          {nextAction && (
            <button
              className="next-action"
              onClick={() => setActive(nextAction.section)}
            >
              <span>Recommended next action</span>
              <strong>{nextAction.label}</strong>
              <small>{nextAction.detail}</small>
            </button>
          )}
        </div>
      </div>
      <div className="briefing-stats">
        <button onClick={() => setActive("Appointments")}>
          <CalendarDays />
          <strong>{todayMeetings}</strong>
          <span>Today’s meetings</span>
        </button>
        <button
          onClick={() => setActive("Tasks & To-do")}
          className={priorityTasks.length ? "attention" : ""}
        >
          <ListTodo />
          <strong>{priorityTasks.length}</strong>
          <span>Priority tasks</span>
        </button>
        <button
          onClick={() => setActive("Maintenance")}
          className={urgentMaintenance ? "urgent" : ""}
        >
          <Wrench />
          <strong>{urgentMaintenance}</strong>
          <span>Urgent maintenance</span>
        </button>
        <button
          onClick={() => setActive("Lease Renewals")}
          className={urgentRenewals + urgentLeases ? "attention" : ""}
        >
          <FileText />
          <strong>{urgentRenewals + urgentLeases}</strong>
          <span>Lease actions</span>
        </button>
      </div>
    </section>
  );
}

function dayPart() {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}
function MaintenanceQuick({
  items,
  setItems,
  manager,
  current,
  profileAssignees,
  onAdd,
  onStatus,
}: any) {
  const [editing, setEditing] = useState<Maintenance | null>(null),
    active = (
      manager
        ? items
        : items.filter((m: Maintenance) =>
            (profileAssignees.includes(m.assigned) || Boolean(current?.profileId && m.sharedWithProfileIds?.includes(current.profileId))),
          )
    ).filter((m: Maintenance) => !m.archived);
  const save = () => {
      if (!editing) return;
      const previous = items.find((m: Maintenance) => m.id === editing.id);
      setItems((all: Maintenance[]) =>
        all.map((m) =>
          m.id === editing.id
            ? {
                ...editing,
                completedAt:
                  editing.status === "Completed"
                    ? editing.completedAt || new Date().toISOString()
                    : undefined,
              }
            : m,
        ),
      );
      if (previous && previous.status !== editing.status)
        onStatus?.(previous, editing.status);
      setEditing(null);
    },
    remove = () => {
      if (editing && window.confirm("Delete this maintenance ticket?")) {
        setItems((all: Maintenance[]) =>
          all.filter((m) => m.id !== editing.id),
        );
        setEditing(null);
      }
    };
  return (
    <>
      <section className="today-maintenance maintenance-overview">
        <div className="panel-heading">
          <div>
            <h2>Maintenance overview</h2>
            <p>Current issues requiring attention</p>
          </div>
          <Button
            variant="outline"
            className="task-section-add"
            onClick={onAdd}
          >
            <Plus />
            Add maintenance
          </Button>
        </div>
        {active.length ? (
          <div className="maintenance-overview-list">
            {active.map((m: Maintenance) => (
              <article
                key={m.id}
                className={`${m.priority === "Urgent" ? "urgent" : ""} ${m.status === "Completed" ? "completed" : ""}`}
              >
                <div>
                  <span className="maintenance-date">{m.date}</span>
                  <h3>{m.issue}</h3>
                  <p>
                    <Building2 />
                    {m.property}
                  </p>
                </div>
                <div className="maintenance-overview-meta">
                  <span
                    className={`maintenance-priority ${m.priority.toLowerCase()}`}
                  >
                    {m.priority === "Urgent" ? "Urgent" : "Not urgent"}
                  </span>
                  <small>{m.assigned}</small>
                  <b>{m.status}</b>
                </div>
                <Button
                  variant="outline"
                  className="maintenance-edit"
                  onClick={() => setEditing({ ...m })}
                >
                  Edit
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <p className="no-events">No maintenance tickets have been logged.</p>
        )}
      </section>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="task-dialog compact-property-dialog">
          <DialogHeader>
            <DialogTitle>Edit maintenance issue</DialogTitle>
            <DialogDescription>
              Update the issue details, responsibility, status and feedback.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="form-grid maintenance-add-form">
              <label>
                Issue
                <input
                  value={editing.issue}
                  onChange={(e) =>
                    setEditing({ ...editing, issue: e.target.value })
                  }
                />
              </label>
              <label>
                Property
                <input
                  value={editing.property}
                  onChange={(e) =>
                    setEditing({ ...editing, property: e.target.value })
                  }
                />
              </label>
              <label>
                Assigned to
                <input
                  value={editing.assigned}
                  onChange={(e) =>
                    setEditing({ ...editing, assigned: e.target.value })
                  }
                />
              </label>
              <label>
                Urgency
                <select
                  value={editing.priority}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      priority: e.target.value as Priority,
                    })
                  }
                >
                  <option value="Normal">Not urgent</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </label>
              <label className="feedback-field">
                Current status
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value })
                  }
                >
                  {maintenanceStatuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="feedback-field">
                Feedback and updates
                <textarea
                  value={editing.feedback}
                  onChange={(e) =>
                    setEditing({ ...editing, feedback: e.target.value })
                  }
                />
              </label>
            </div>
          )}
          <DialogFooter className="maintenance-edit-footer">
            <Button className="dialog-delete" onClick={remove}>
              Delete
            </Button>
            <span />
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button className="add-button" onClick={save}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function HistorySwitch({ history, setHistory }: any) {
  return (
    <div className="history-switch">
      <button
        className={!history ? "selected" : ""}
        onClick={() => setHistory(false)}
      >
        Active
      </button>
      <button
        className={history ? "selected" : ""}
        onClick={() => setHistory(true)}
      >
        History
      </button>
    </div>
  );
}
function TasksView({
  items,
  visible,
  setTasks,
  manager,
  profileAssignees,
  onTaskStatus,
  colours,
  onRenameColour,
}: any) {
  const [history, setHistory] = useState(false),
    historyItems = items
      .filter(
        (task: Task) =>
          task.archived &&
          (manager || profileAssignees.includes(task.assignee)),
      )
      .sort((a: Task, b: Task) =>
        (b.archivedAt || "").localeCompare(a.archivedAt || ""),
      ),
    shown = history ? historyItems : visible;
  return (
    <section className="task-panel standalone">
      <div className="panel-heading">
        <div>
          <h2>Task list</h2>
          <p>All work in your selected profile view</p>
        </div>
        <HistorySwitch history={history} setHistory={setHistory} />
        <span className="count-pill">
          {shown.length} {history ? "completed" : "active"}
        </span>
      </div>
      <TaskRows
        items={shown}
        setTasks={setTasks}
        onStatusChange={onTaskStatus}
        colours={colours}
        onRenameColour={onRenameColour}
      />
    </section>
  );
}
function CalendarCard({
  appointments,
  onAdd,
  onEdit,
  onDelete,
  calendarControls,
}: any) {
  const today = appointments
    .filter((a: Appointment) => a.date === dateKey(0) || a.date === "Today")
    .sort((a: Appointment, b: Appointment) => a.time.localeCompare(b.time));
  return (
    <section className="calendar-card">
      <div className="panel-heading">
        <div>
          <h2>Today’s calendar</h2>
          <p>{today.length} meetings and appointments · tap to edit</p>
        </div>
        <div className="calendar-actions">
          {onAdd && (
            <Button variant="outline" className="calendar-add" onClick={onAdd}>
              <Plus />
              Add meeting
            </Button>
          )}
          <span className="today-badge">TODAY</span>
        </div>
      </div>
      {today.length ? (
        today.map((a: Appointment) => (
          <Meeting
            key={a.id}
            appointment={a}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      ) : (
        <p className="no-events calendar-empty">
          No meetings scheduled for today
        </p>
      )}
    </section>
  );
}
function Meeting({ appointment, onEdit, onDelete }: any) {
  const {
    time,
    endTime,
    allDay,
    title,
    place,
    duration = "60 minutes",
    meetingLink,
  } = appointment;
  let hold: number | undefined,
    held = false;
  const startHold = () => {
      held = false;
      hold = window.setTimeout(() => {
        held = true;
        onDelete?.(appointment.id);
      }, 650);
    },
    stopHold = () => window.clearTimeout(hold);
  return (
    <div
      className="meeting meeting-button"
      style={appointment.colourHex ? { background: `linear-gradient(90deg, ${appointment.colourHex} 0%, #ffffff 82%)` } : undefined}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (held) {
          held = false;
          return;
        }
        onEdit?.({ ...appointment });
      }}
      onKeyDown={(e) =>
        (e.key === "Enter" || e.key === " ") && onEdit?.({ ...appointment })
      }
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onContextMenu={(e) => {
        e.preventDefault();
        onDelete?.(appointment.id);
      }}
    >
      <time>{allDay ? "All day" : time}</time>
      <div className="meeting-line greenline" style={appointment.colourAccent ? { background: appointment.colourAccent } : undefined} />
      <div>
        <strong>{title}</strong>
        <CategoryTag label={appointment.colourLabel} colour={appointment.colourHex} accent={appointment.colourAccent} />
        <span>{place}</span>
        {meetingLink && (
          <a
            className="meeting-link"
            href={meetingLink}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Join Zoom / Teams meeting
          </a>
        )}
        <small>
          {allDay ? "Whole day" : endTime ? `${time} – ${endTime}` : duration}
          <em>Tap to edit · hold to delete</em>
        </small>
      </div>
    </div>
  );
}
function CalendarView({
  manager,
  appointments,
  onEdit,
  onDelete,
  calendarControls,
}: any) {
  const today = new Date(),
    [month, setMonth] = useState(
      new Date(today.getFullYear(), today.getMonth(), 1),
    ),
    [selectedDate, setSelectedDate] = useState(dateKey(0)),
    [dayOpen, setDayOpen] = useState(false),
    swipeStartX = useRef<number | null>(null),
    monthStart = new Date(month.getFullYear(), month.getMonth(), 1),
    gridStart = new Date(monthStart),
    holidays = southAfricanPublicHolidays(month.getFullYear());
  gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
      const value = new Date(gridStart);
      value.setDate(value.getDate() + index);
      return value;
    }),
    appointmentDate = (item: Appointment) =>
      item.date === "Today"
        ? dateKey(0)
        : item.date === "Tomorrow"
          ? dateKey(1)
          : item.date,
    appointmentOccursOn = (item: Appointment, date: string) => {
      const start = appointmentDate(item),
        end = item.endDate || start;
      return start <= date && date <= end;
    },
    dayAppointments = appointments
      .filter((item: Appointment) => appointmentOccursOn(item, selectedDate))
      .sort((a: Appointment, b: Appointment) => a.time.localeCompare(b.time)),
    selectedHoliday = southAfricanPublicHolidays(
      Number(selectedDate.slice(0, 4)),
    ).get(selectedDate);
  const moveMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDate(next.toLocaleDateString("en-CA"));
  };
  return (
    <div className="month-calendar-layout">
      <section
        className="month-calendar-card"
        onTouchStart={(event) => {
          swipeStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (swipeStartX.current === null) return;
          const distance =
            event.changedTouches[0].clientX - swipeStartX.current;
          if (Math.abs(distance) > 55) moveMonth(distance < 0 ? 1 : -1);
          swipeStartX.current = null;
        }}
      >
        <header className="month-calendar-head">
          <button onClick={() => moveMonth(-1)} aria-label="Previous month">
            <ChevronLeft />
          </button>
          <div>
            <h2 className="visible-month-title">
              {new Intl.DateTimeFormat("en-ZA", {
                month: "long",
                year: "numeric",
              }).format(month)}
            </h2>
            <button
              className="calendar-today-button"
              onClick={() => {
                setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setSelectedDate(dateKey(0));
              }}
            >
              Today
            </button>
          </div>
          <button onClick={() => moveMonth(1)} aria-label="Next month">
            <ChevronRight />
          </button>
        </header>
        <div className="month-weekdays">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="month-grid">
          {calendarDays.map((day) => {
            const key = day.toLocaleDateString("en-CA"),
              events = appointments
                .filter((item: Appointment) => appointmentOccursOn(item, key))
                .sort((a: Appointment, b: Appointment) =>
                  a.time.localeCompare(b.time),
                ),
              holiday = southAfricanPublicHolidays(day.getFullYear()).get(key);
            return (
              <button
                key={key}
                className={`${day.getMonth() !== month.getMonth() ? "outside" : ""} ${key === dateKey(0) ? "today" : ""} ${key === selectedDate ? "selected" : ""} ${holiday ? "holiday" : ""}`}
                onClick={() => {
                  setSelectedDate(key);
                  setDayOpen(true);
                }}
              >
                <strong>{day.getDate()}</strong>
                {holiday && <small>{holiday}</small>}
                {events.length > 0 && (
                  <span className="calendar-day-events">
                    {events.map((event: Appointment) => (
                      <em key={event.id} style={event.colourHex ? { background: event.colourHex, color: "#3d554e", borderLeft: `3px solid ${event.colourAccent || "#718f84"}`, borderRadius: 4, padding: "1px 4px" } : undefined}>
                        <time>{event.allDay ? "All day" : event.time}</time>
                        {event.title}
                      </em>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
      <section className="selected-day-card">
        <header>
          <div>
            <span>SELECTED DAY</span>
            <h2>{dateLabel(selectedDate)}</h2>
            <p>{formatDate(selectedDate)}</p>
          </div>
          <Button
            className="add-button"
            onClick={() => calendarControls.openAdd(selectedDate)}
          >
            <Plus /> Add appointment
          </Button>
        </header>
        {selectedHoliday && (
          <p className="public-holiday-label">
            <CalendarDays /> South African public holiday · {selectedHoliday}
          </p>
        )}
        <div className="selected-day-events">
          {dayAppointments.length ? (
            dayAppointments.map((appointment: Appointment) => (
              <Meeting
                key={appointment.id}
                appointment={appointment}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          ) : (
            <p className="no-events">No appointments scheduled for this day.</p>
          )}
        </div>
        <p className="info-note">
          {manager
            ? "Each person connects their own Google Calendar in Settings."
            : "Google appointments sync automatically every five minutes."}
        </p>
      </section>
      <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="task-dialog calendar-day-dialog">
          <DialogHeader>
            <DialogTitle>{dateLabel(selectedDate)}</DialogTitle>
            <DialogDescription>
              {formatDate(selectedDate)} · View the day or add something new.
            </DialogDescription>
          </DialogHeader>
          {selectedHoliday && (
            <p className="public-holiday-label">
              <CalendarDays /> South African public holiday · {selectedHoliday}
            </p>
          )}
          <div className="calendar-day-dialog-actions">
            <Button
              className="add-button"
              onClick={() => {
                setDayOpen(false);
                calendarControls.openAdd(selectedDate);
              }}
            >
              <CalendarDays /> Add meeting / appointment
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDayOpen(false);
                calendarControls.openTask(selectedDate);
              }}
            >
              <ListTodo /> Add task for this day
            </Button>
          </div>
          <div className="calendar-day-dialog-events">
            <h3>Schedule</h3>
            {dayAppointments.length ? (
              dayAppointments.map((appointment: Appointment) => (
                <Meeting
                  key={appointment.id}
                  appointment={appointment}
                  onEdit={(item: Appointment) => {
                    setDayOpen(false);
                    onEdit(item);
                  }}
                  onDelete={onDelete}
                />
              ))
            ) : (
              <p className="no-events">Nothing scheduled for this day yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function CalendarConnection({ controls }: any) {
  return (
    <div
      className={`google-calendar-status ${controls.connected ? "connected" : ""}`}
    >
      <div>
        <CalendarDays />
        <span>
          <strong>
            {controls.connected
              ? "Google Calendar connected"
              : "Connect Google Calendar"}
          </strong>
          <small>
            {controls.connected
              ? "Events sync automatically for the next 45 days."
              : "Connect once to import events and save new appointments directly."}
          </small>
        </span>
      </div>
      <div>
        {controls.connected ? (
          <>
            <Button
              variant="outline"
              disabled={controls.loading}
              onClick={controls.refresh}
            >
              {controls.loading ? (
                <Loader2 className="spin" />
              ) : (
                <CalendarDays />
              )}
              {controls.loading ? "Syncing…" : "Sync now"}
            </Button>
            <button
              className="calendar-disconnect"
              onClick={controls.disconnect}
            >
              Disconnect
            </button>
          </>
        ) : (
          <Button className="add-button" onClick={controls.connect}>
            Connect
          </Button>
        )}
      </div>
      {controls.error && <p>{controls.error}</p>}
    </div>
  );
}
function RenewalsView({
  items,
  setItems,
  manager,
  current,
  users,
  onAdd,
  onUpdate,
}: any) {
  const [history, setHistory] = useState(false),
    assignees = getProfileAssignees(users, current),
    scoped = (
      manager
        ? items
        : items.filter((r: LeaseRenewal) => assignees.includes(r.assigned))
    )
      .filter((r: LeaseRenewal) =>
        history ? Boolean(r.archived) : !r.archived,
      )
      .sort((a: LeaseRenewal, b: LeaseRenewal) =>
        a.leaseEndDate.localeCompare(b.leaseEndDate),
      );
  const update = (
      item: LeaseRenewal,
      changes: Partial<LeaseRenewal>,
      message: string,
    ) => {
      setItems((all: LeaseRenewal[]) =>
        all.map((r) => (r.id === item.id ? { ...r, ...changes } : r)),
      );
      onUpdate?.(item, message);
    },
    toggleAction = (item: LeaseRenewal, action: string) => {
      const actions = renewalCompletedActions(item),
        checked = actions.includes(action),
        completedActions = checked
          ? actions.filter((value) => value !== action)
          : [...actions, action];
      update(
        item,
        { completedActions },
        `${action} ${checked ? "reopened" : "completed"}`,
      );
    },
    setRenewed = (item: LeaseRenewal, value: "Yes" | "No") =>
      update(
        item,
        {
          landlordDecision: item.landlordDecision === value ? "Pending" : value,
          tenantDecision: "Pending",
        },
        `lease renewal changed to ${value}`,
      ),
    followUp = (item: LeaseRenewal) =>
      update(
        item,
        {
          lastFollowUpAt: new Date().toISOString(),
          nextFollowUpDate: addBusinessDays(dateKey(0), 2),
        },
        "follow-up completed; next reminder scheduled",
      ),
    archive = (item: LeaseRenewal) => {
      if (item.archived) {
        update(
          item,
          { archived: false, archivedAt: undefined },
          "lease renewal restored to active",
        );
        return;
      }
      if (
        !window.confirm("Mark this lease renewal as completed and archive it?")
      )
        return;
      update(
        item,
        { archived: true, archivedAt: new Date().toISOString() },
        "lease renewal completed and archived",
      );
    },
    remove = (id: number) => {
      if (window.confirm("Delete this lease renewal record?"))
        setItems((all: LeaseRenewal[]) => all.filter((r) => r.id !== id));
    };
  return (
    <div className="renewals-list">
      <div className="renewals-toolbar">
        <div>
          <strong>{scoped.length}</strong>
          <span>{history ? "Completed renewals" : "Active renewals"}</span>
        </div>
        <Button className="add-button" onClick={onAdd}>
          <Plus />
          Add lease renewal
        </Button>
        <HistorySwitch history={history} setHistory={setHistory} />
      </div>
      {scoped.length ? (
        scoped.map((r: LeaseRenewal) => {
          const completedActions = renewalCompletedActions(r),
            requiredActions = renewalActions.filter(
              (action) => action !== "Awaiting documents if FICA has changed",
            ),
            completedCount =
              requiredActions.filter((action) =>
                completedActions.includes(action),
              ).length +
              (r.ficaChanged &&
              completedActions.includes(
                "Awaiting documents if FICA has changed",
              )
                ? 1
                : 0),
            totalActions = requiredActions.length + (r.ficaChanged ? 1 : 0),
            veryUrgent = daysUntil(r.leaseEndDate) <= 31,
            due = r.nextFollowUpDate <= dateKey(0) || veryUrgent;
          return (
            <article
              className={`renewal-card ${due ? "followup-due" : ""}`}
              key={r.id}
            >
              <div className="renewal-head">
                <div>
                  <span className="renewal-label">LEASE RENEWAL</span>
                  <h2>{r.property}</h2>
                  <p>
                    Lease expires <b>{formatDate(r.leaseEndDate)}</b> · Contact
                    landlord by{" "}
                    <b>{formatDate(renewalContactDate(r.leaseEndDate))}</b>
                  </p>
                  {r.sourceName && <small>Source: {r.sourceName}</small>}
                </div>
                <div className="renewal-head-actions">
                  {due && (
                    <span className="followup-badge">
                      {veryUrgent
                        ? "VERY URGENT · FINALISE ASAP"
                        : "FOLLOW-UP DUE"}
                    </span>
                  )}
                  <button
                    className="maintenance-delete"
                    onClick={() => remove(r.id)}
                  >
                    Delete record
                  </button>
                </div>
              </div>
              <section className="renewal-decision">
                <strong>Is the lease being renewed?</strong>
                <div>
                  <label
                    className={
                      r.landlordDecision === "Yes" ? "selected yes" : ""
                    }
                  >
                    <Checkbox
                      checked={r.landlordDecision === "Yes"}
                      onCheckedChange={() => setRenewed(r, "Yes")}
                    />
                    <span>Yes</span>
                  </label>
                  <label
                    className={r.landlordDecision === "No" ? "selected no" : ""}
                  >
                    <Checkbox
                      checked={r.landlordDecision === "No"}
                      onCheckedChange={() => setRenewed(r, "No")}
                    />
                    <span>No</span>
                  </label>
                </div>
              </section>
              <div
                className={`renewal-fields renewal-top-fields ${r.landlordDecision === "Yes" ? "" : "renewal-assignee-only"}`}
              >
                <label>
                  Assigned to
                  <select
                    value={r.assigned}
                    onChange={(e) =>
                      update(
                        r,
                        { assigned: e.target.value },
                        `assigned to ${e.target.value}`,
                      )
                    }
                  >
                    {(manager
                      ? users
                      : users.filter((u: User) => assignees.includes(u.short))
                    ).map((u: User) => (
                      <option key={u.name} value={u.short}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
                {r.landlordDecision === "Yes" && (
                  <>
                    <label>
                      New monthly rent
                      <input
                        value={r.newRent}
                        onChange={(e) =>
                          update(
                            r,
                            { newRent: e.target.value },
                            "new monthly rent updated",
                          )
                        }
                        placeholder="e.g. R 15 500"
                      />
                    </label>
                    <label className="renewal-terms">
                      Additional renewal terms
                      <textarea
                        value={r.renewalTerms}
                        onChange={(e) =>
                          update(
                            r,
                            { renewalTerms: e.target.value },
                            "renewal terms updated",
                          )
                        }
                      />
                    </label>
                  </>
                )}
              </div>
              {r.landlordDecision === "No" ? (
                <div className="wcu-warning exit-instruction">
                  <strong>Lease is not being renewed</strong>
                  <span>Exit the lease on WCU.</span>
                </div>
              ) : (
                <>
                  <section className="renewal-action-checklist">
                    <div className="renewal-checklist-heading">
                      <div>
                        <span>ACTION POINTS</span>
                        <strong>
                          {completedCount} of {totalActions} completed
                        </strong>
                      </div>
                      <div className="step-progress">
                        <i
                          style={{
                            width: `${totalActions ? (completedCount / totalActions) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="renewal-check-grid">
                      {renewalActions.map((action) =>
                        action === "Awaiting documents if FICA has changed" ? (
                          <div className="fica-action-block" key={action}>
                            <label
                              className={`fica-change-toggle ${r.ficaChanged ? "selected" : ""}`}
                            >
                              <Checkbox
                                checked={Boolean(r.ficaChanged)}
                                onCheckedChange={(value) =>
                                  update(
                                    r,
                                    {
                                      ficaChanged: Boolean(value),
                                      ...(!value
                                        ? {
                                            outstandingFicaDocs: "",
                                            completedActions:
                                              completedActions.filter(
                                                (item) => item !== action,
                                              ),
                                          }
                                        : {}),
                                    },
                                    value
                                      ? "FICA changes noted"
                                      : "FICA changes cleared",
                                  )
                                }
                              />
                              <span>
                                FICA details have changed / updated documents
                                required
                              </span>
                            </label>
                            {r.ficaChanged && (
                              <label className="fica-waiting-field">
                                What documents are you waiting for?
                                <textarea
                                  value={r.outstandingFicaDocs || ""}
                                  onChange={(e) =>
                                    update(
                                      r,
                                      { outstandingFicaDocs: e.target.value },
                                      "outstanding FICA documents updated",
                                    )
                                  }
                                  placeholder="Type the outstanding documents here..."
                                />
                              </label>
                            )}
                          </div>
                        ) : (
                          <label
                            className={
                              completedActions.includes(action) ? "checked" : ""
                            }
                            key={action}
                          >
                            <Checkbox
                              checked={completedActions.includes(action)}
                              onCheckedChange={() => toggleAction(r, action)}
                            />
                            <span>{action}</span>
                          </label>
                        ),
                      )}
                    </div>
                  </section>
                </>
              )}
              <label className="standalone-notes">
                Notes and correspondence
                <textarea
                  value={r.notes}
                  onChange={(e) =>
                    update(r, { notes: e.target.value }, "notes updated")
                  }
                />
              </label>
              <div className="renewal-followup">
                <div>
                  <span>Next follow-up</span>
                  <strong>{formatDate(r.nextFollowUpDate)}</strong>
                </div>
                <Button variant="outline" onClick={() => followUp(r)}>
                  <Check />
                  Follow-up done today
                </Button>
              </div>
              <label className="renewal-archive">
                <Checkbox
                  checked={Boolean(r.archived)}
                  onCheckedChange={() => archive(r)}
                />
                <span>
                  <strong>
                    {r.archived
                      ? "Restore lease renewal"
                      : "Lease renewal completed"}
                  </strong>
                  <small>
                    {r.archived
                      ? "Return this renewal to Active"
                      : "Tick to archive this renewal"}
                  </small>
                </span>
              </label>
            </article>
          );
        })
      ) : (
        <div className="empty-state renewal-empty">
          <FileText />
          <h3>
            {history
              ? "No completed lease renewals"
              : "No active lease renewals"}
          </h3>
          <p>
            {history
              ? "Completed renewals will appear here."
              : "Add a lease renewal to start tracking it."}
          </p>
          <Button className="add-button" onClick={onAdd}>
            <Plus />
            Add lease renewal
          </Button>
        </div>
      )}
    </div>
  );
}
function TeamProgress({ manager }: any) {
  return (
    <section className="team-progress">
      <div className="panel-heading">
        <div>
          <h2>{manager ? "Management progress" : "My progress"}</h2>
          <p>Individual work today</p>
        </div>
      </div>
      {(manager
        ? [
            ["Melissa Slabber", "MS", 3, 5],
            ["Arno de Wit", "AD", 2, 4],
          ]
        : [["Melissa Slabber", "MS", 3, 5]]
      ).map(([n, i, d, t]) => (
        <div className="member" key={String(n)}>
          <span className="member-avatar">{i}</span>
          <div>
            <strong>{n}</strong>
            <div className="progress">
              <i style={{ width: `${(Number(d) / Number(t)) * 100}%` }} />
            </div>
          </div>
          <small>
            {d}/{t}
          </small>
        </div>
      ))}
    </section>
  );
}
function ManagerHome({ setActive, users }: any) {
  const staffCount = users.filter((user: User) => user.role !== "Manager").length;
  return (
    <section className="manager-choice-page">
      <style>{`
        .manager-choice-page{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
        .manager-choice-card{display:flex;min-height:210px;padding:24px;border:1px solid #c8ddd5;border-radius:18px;background:#fff;text-align:left;color:#173d33;box-shadow:0 10px 30px rgba(12,75,59,.08);cursor:pointer}
        .manager-choice-card>span{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
        .manager-choice-card svg{width:34px;height:34px;padding:10px;border-radius:12px;background:#e4f2ed;color:#08705a}
        .manager-choice-card strong{font:700 28px Georgia,serif}
        .manager-choice-card small{color:#657d75;font-size:13px;line-height:1.55}
        .manager-choice-card b{margin-top:auto;color:#08705a;font-size:12px}
        .manager-section-back{margin:0 0 16px;padding:10px 14px;border:1px solid #c8ddd5;border-radius:10px;background:#fff;color:#08705a;font-weight:800;cursor:pointer}
        @media(max-width:620px){.manager-choice-page{grid-template-columns:1fr}.manager-choice-card{min-height:170px;padding:20px}}
      `}</style>
      <button className="manager-choice-card" onClick={() => setActive("Staff")}>
        <span><Users /><strong>Staff</strong><small>View and manage staff, offices and connections.</small><b>{staffCount} active staff members →</b></span>
      </button>
      <button className="manager-choice-card" onClick={() => setActive("Reporting")}>
        <span><ClipboardCheck /><strong>Reporting</strong><small>Open regional performance, year-to-year history and annual totals.</small><b>Open manager reporting →</b></span>
      </button>
      <button className="manager-choice-card" onClick={() => setActive("AI Staff Adviser")}>
        <span><Sparkles /><strong>AI Staff Adviser</strong><small>Get practical advice from staff performance and workload information.</small><b>View staff recommendations →</b></span>
      </button>
    </section>
  );
}
function ManagerAITeamCoach({ users, records, tasks }: any) {
  const staff = users.filter((user: User) => user.role !== "Manager"),
    completedProfiles = records.filter((record: StaffManagementRecord) =>
      staff.some((user: User) => user.profileId === record.profileId),
    ),
    missingProfiles = staff.length - completedProfiles.length,
    openTasks = tasks.filter((task: Task) => !task.done && !task.archived),
    urgentTasks = openTasks.filter((task: Task) => task.priority === "Urgent"),
    overdueTasks = openTasks.filter((task: Task) => taskDueState(task.due) === "Overdue"),
    latestRows = completedProfiles
      .map((record: StaffManagementRecord) => [...(record.months || [])].sort((a, b) => b.month.localeCompare(a.month))[0])
      .filter(Boolean),
    totalLeases = latestRows.reduce((sum: number, row: any) => sum + Number(row.totalLeases || row.newTenantLeases || 0) + Number(row.leaseRenewals || 0), 0),
    totalProperties = latestRows.reduce((sum: number, row: any) => sum + Number(row.newProperties || 0), 0),
    developmentItems = completedProfiles.filter((record: StaffManagementRecord) => record.developmentAreas?.trim()).length,
    activeIssues = completedProfiles.filter((record: StaffManagementRecord) => record.issues?.trim()).length,
    advice = [
      missingProfiles > 0
        ? { title: "Complete the staff picture", text: `Add performance information for ${missingProfiles} staff member${missingProfiles === 1 ? "" : "s"}. Advice becomes more reliable when every staff profile is up to date.`, level: "attention" }
        : { title: "Staff information is covered", text: "All active staff have management records. Keep the monthly figures current so comparisons stay useful.", level: "positive" },
      overdueTasks > 0
        ? { title: "Clear overdue work first", text: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? " needs" : "s need"} attention. Assign an owner and a firm completion date before adding lower-priority work.`, level: "attention" }
        : { title: "Deadlines are under control", text: "There are no overdue open tasks. Protect this by reviewing deadlines briefly at the start of each day.", level: "positive" },
      urgentTasks.length > 0
        ? { title: "Balance urgent workload", text: `There are ${urgentTasks.length} urgent open items. Check that they are spread fairly and move support to anyone carrying several at once.`, level: "attention" }
        : { title: "No urgent workload pressure", text: "No urgent open tasks are currently recorded. Use the available capacity for follow-ups and proactive landlord contact.", level: "positive" },
      totalProperties === 0
        ? { title: "Strengthen property growth activity", text: "No new properties appear in the latest entered month. Set a simple weekly prospecting target per agent and review conversion at month-end.", level: "focus" }
        : { title: "Build on property growth", text: `The latest entered figures include ${totalProperties} new propert${totalProperties === 1 ? "y" : "ies"} and ${totalLeases} completed leases. Identify which activities produced them and repeat those across the staff.`, level: "positive" },
      developmentItems > 0
        ? { title: "Turn development notes into actions", text: `${developmentItems} staff profile${developmentItems === 1 ? " contains" : "s contain"} development areas. Give each person one measurable action and review date rather than several broad goals.`, level: "focus" }
        : { title: "Record development priorities", text: "Add at least one development area for each staff member so coaching conversations remain focused and measurable.", level: "focus" },
      activeIssues > 0
        ? { title: "Resolve recurring blockers", text: `${activeIssues} staff profile${activeIssues === 1 ? " includes" : "s include"} recorded issues. Look for repeated themes before treating each issue separately.`, level: "attention" }
        : { title: "Keep blockers visible", text: "No staff issues are currently recorded. Continue asking about obstacles during regular one-to-ones.", level: "positive" },
    ];
  return (
    <section className="ai-team-coach">
      <style>{`
        .ai-team-coach{padding:22px;border-radius:20px;background:linear-gradient(145deg,#075d4b,#0a745d);color:#fff}
        .ai-team-coach .ai-coach-head{position:static;inset:auto;width:auto;height:auto;min-height:0;display:flex;gap:14px;align-items:flex-start;margin:0 0 20px;padding:0;border:0;background:transparent;box-shadow:none;color:#fff;overflow:visible}
        .ai-coach-head>div{min-width:0;flex:1}
        .ai-coach-head svg{flex:none;width:30px;height:30px;padding:10px;border-radius:13px;background:#d3af66;color:#153d33}
        .ai-coach-head span{font-size:10px;font-weight:850;letter-spacing:.12em;color:#e3ca96}
        .ai-coach-head h2{margin:5px 0 4px;font:700 28px Georgia,serif}
        .ai-coach-head p{margin:0;color:#d5e8e2;font-size:13px;line-height:1.5}
        .ai-coach-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px}
        .ai-coach-summary article{padding:14px;border:1px solid rgba(255,255,255,.2);border-radius:12px;background:rgba(255,255,255,.09)}
        .ai-coach-summary strong{display:block;font:700 24px Georgia,serif}.ai-coach-summary span{display:block;margin-top:5px;font-size:11px;line-height:1.35;color:#d5e8e2}
        .ai-coach-advice{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .ai-coach-advice article{padding:16px;border-radius:13px;background:#fff;color:#173d33;border-left:5px solid #d3af66}
        .ai-coach-advice article.positive{border-left-color:#39a77f}.ai-coach-advice article.attention{border-left-color:#c24755}
        .ai-coach-advice h3{margin:0 0 7px;font-size:15px}.ai-coach-advice p{margin:0;color:#62786f;font-size:12px;line-height:1.55}
        .ai-coach-note{margin:16px 0 0;color:#cde2db;font-size:10px}
        @media(max-width:620px){.ai-team-coach{padding:17px}.ai-team-coach .ai-coach-head{gap:11px;margin-bottom:17px}.ai-coach-head svg{width:26px;height:26px;padding:8px}.ai-coach-head h2{font-size:24px;line-height:1.1}.ai-coach-head p{font-size:12px}.ai-coach-summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.ai-coach-summary article{padding:12px 9px}.ai-coach-summary strong{font-size:22px}.ai-coach-summary span{font-size:9px}.ai-coach-advice{grid-template-columns:1fr}}
      `}</style>
      <header className="ai-coach-head"><Sparkles /><div><span>MANAGER AI INSIGHTS</span><h2>AI Staff Adviser</h2><p>Recommendations based on the staff and performance information currently saved in the app.</p></div></header>
      <div className="ai-coach-summary">
        <article><strong>{staff.length}</strong><span>Staff members</span></article>
        <article><strong>{overdueTasks.length}</strong><span>Overdue tasks</span></article>
        <article><strong>{urgentTasks.length}</strong><span>Urgent open items</span></article>
      </div>
      <div className="ai-coach-advice">{advice.map((item) => <article className={item.level} key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      <p className="ai-coach-note">Advice updates automatically when staff records, monthly figures and task statuses change.</p>
    </section>
  );
}
function TeamView({
  manager,
  current,
  users,
  saveUsers,
  tasks,
  setTasks,
  onTaskStatus,
  staffManagement,
  setStaffManagement,
  staffConnections,
  setStaffConnections,
}: any) {
  const [selected, setSelected] = useState<User | null>(null),
    [managing, setManaging] = useState<User | null>(null),
    [addOpen, setAddOpen] = useState(false),
    [created, setCreated] = useState<User | null>(null),
    [creating, setCreating] = useState(false),
    [createError, setCreateError] = useState(""),
    [newUser, setNewUser] = useState({
      name: "",
      role: "Agent",
      email: "",
      cellphone: "",
      region: "B&O",
      office: "",
      connectedProfileIds: [] as string[],
    });
  const personalAssignees = getProfileAssignees(users, current),
    personalTasks = tasks.filter((t: Task) =>
      personalAssignees.includes(t.assignee),
    );
  if (!manager)
    return (
      <section className="profile-page">
        <div className="large-avatar">{current.initials}</div>
        <h2>{current.name}</h2>
        <p>{current.role} · Boland, Overberg and Cape Region Rentals</p>
        {current.role !== "Manager" && current.linkedTo && (
          <span className="linked-profile">
            <Users />
            Shared profile with{" "}
            {users.find((u: User) => u.short === current.linkedTo)?.name ||
              current.linkedTo}
          </span>
        )}
        {current.role !== "Manager" && <div className="profile-stats">
          <article>
            <strong>{personalTasks.filter((t: Task) => !t.done).length}</strong>
            <span>Open tasks</span>
          </article>
          <article>
            <strong>
              {
                personalTasks.filter(
                  (t: Task) => taskDueState(t.due) === "Overdue" && !t.done,
                ).length
              }
            </strong>
            <span>Overdue</span>
          </article>
          <article>
            <strong>{personalTasks.filter((t: Task) => t.done).length}</strong>
            <span>Completed</span>
          </article>
        </div>}
      </section>
    );
  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.cellphone || creating)
      return;
    setCreating(true);
    setCreateError("");
    try {
      const parts = newUser.name.trim().split(/\s+/),
        short = parts[0],
        initials = parts
          .map((p: string) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        code = String(Math.floor(100000 + Math.random() * 900000)),
        role = newUser.role.toLowerCase() as "manager" | "agent" | "assistant";
      if (role !== "manager" && !newUser.office) throw new Error("Select the staff member's office.");
      if (supabaseConfigured) {
        const row: any = await createStaffProfile({
            name: newUser.name,
            shortName: short,
            initials,
            role,
            email: newUser.email,
            cellphone: newUser.cellphone,
            accessCode: code,
            newTeamName: `${newUser.name.trim()} workspace`,
          }),
          activationToken = await createStaffActivationToken(row.id, code),
          user: User = {
            name: row.full_name || newUser.name,
            short: row.short_name || short,
            initials: row.initials || initials,
            role: newUser.role,
            code,
            email: row.email || newUser.email,
            cellphone: row.cellphone || newUser.cellphone,
            profileId: row.id,
            teamId: row.team_id,
            activationToken,
          };
        saveUsers([...users, user]);
        if (role !== "manager") {
          await saveStaffConnections(row.id, newUser.connectedProfileIds);
          setStaffConnections((links: StaffConnection[]) => [
            ...links.filter((link) => link.profileAId !== row.id && link.profileBId !== row.id),
            ...newUser.connectedProfileIds.map((otherId: string) => {
              const [profileAId, profileBId] = [row.id, otherId].sort();
              return { profileAId, profileBId };
            }),
          ]);
          const record: StaffManagementRecord = { profileId: row.id, region: newUser.region, office: newUser.office, managerProfileId: current.profileId || "", strengths: "", developmentAreas: "", issues: "", coachingPlan: "", months: [] };
          await saveStaffManagementRecord(record);
          setStaffManagement((all: StaffManagementRecord[]) => [...all.filter((item) => item.profileId !== row.id), record]);
        }
        setCreated(user);
      } else {
        const user: User = {
          ...newUser,
          short,
          initials,
          code,
        };
        saveUsers([...users, user]);
        setCreated(user);
      }
      setNewUser({
        name: "",
        role: "Agent",
        email: "",
        cellphone: "",
        region: "B&O",
        office: "",
        connectedProfileIds: [],
      });
    } catch (error: any) {
      setCreateError(
        error?.message?.includes("three active")
          ? "That team already has three active staff members."
          : error?.message || "The user could not be created.",
      );
    } finally {
      setCreating(false);
    }
  };
  if (selected) {
    const linkedAssignees = getProfileAssignees(users, selected),
      personTasks = tasks.filter((t: Task) =>
        linkedAssignees.includes(t.assignee),
      ),
      linkedOwner = selected.role !== "Manager" && selected.linkedTo
        ? users.find((u: User) => u.short === selected.linkedTo)
        : null;
    return (
      <div className="user-detail">
        <button className="back-users" onClick={() => setSelected(null)}>
          ← Back to users
        </button>
        <section className="profile-page">
          <div className="large-avatar">{selected.initials}</div>
          <h2>{selected.name}</h2>
          <p>{selected.role} · Boland, Overberg and Cape Region Rentals</p>
          {linkedOwner && (
            <span className="linked-profile">
              <Users />
              Linked to {linkedOwner.name}’s profile
            </span>
          )}
          <div className="contact-line">
            <span>{selected.email || "Email not added"}</span>
            <span>{selected.cellphone || "Cellphone not added"}</span>
            <span>
              Access code: <b>{selected.code}</b>
            </span>
          </div>
          {selected.role !== "Manager" && <div className="profile-stats">
            <article>
              <strong>{personTasks.filter((t: Task) => !t.done).length}</strong>
              <span>Open tasks</span>
            </article>
            <article>
              <strong>
                {
                  personTasks.filter(
                    (t: Task) => t.priority === "Urgent" && !t.done,
                  ).length
                }
              </strong>
              <span>Urgent</span>
            </article>
            <article>
              <strong>{personTasks.filter((t: Task) => t.done).length}</strong>
              <span>Completed</span>
            </article>
          </div>}
        </section>
        {selected.role !== "Manager" && selected.profileId && (
          <StaffPerformancePanel
            user={selected}
            users={users}
            record={staffManagement.find(
              (item: StaffManagementRecord) =>
                item.profileId === selected.profileId,
            )}
            onSave={async (record: StaffManagementRecord) => {
              setStaffManagement((all: StaffManagementRecord[]) => [
                ...all.filter((item) => item.profileId !== record.profileId),
                record,
              ]);
              await saveStaffManagementRecord(record);
            }}
          />
        )}
        {selected.role !== "Manager" && <section className="task-panel standalone">
          <div className="panel-heading">
            <div>
              <h2>{selected.short}’s shared task status</h2>
              <p>Includes tasks for everyone linked to this profile</p>
            </div>
          </div>
          <TaskRows
            items={personTasks}
            setTasks={setTasks}
            onStatusChange={onTaskStatus}
          />
        </section>}
      </div>
    );
  }
  return (
    <>
      <style>{`
        details.regional-staff-group>summary, details.office-staff-group>summary{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:12px;cursor:pointer;list-style:none}
        details.regional-staff-group>summary::-webkit-details-marker, details.office-staff-group>summary::-webkit-details-marker{display:none}
        details.regional-staff-group>summary:after, details.office-staff-group>summary:after{content:'⌄';font-size:22px;color:#0b6653;transition:transform .2s ease}
        details[open].regional-staff-group>summary:after, details[open].office-staff-group>summary:after{transform:rotate(180deg)}
        details.regional-staff-group>summary{padding:15px 18px;background:linear-gradient(120deg,#eef7f3,#f8fbfa)}
        details.regional-staff-group>summary>div{min-width:0}
        details.regional-staff-group>summary span{display:block;color:#08705a;font-size:8px;font-weight:900;letter-spacing:.13em;line-height:1.2}
        details.regional-staff-group>summary h2{margin:3px 0 0;color:#173d33;font:700 21px Georgia,serif;line-height:1.15}
        details.regional-staff-group>summary>strong{color:#5b746b;font-size:11px;white-space:nowrap}
        details.office-staff-group{border:1px solid #d5e1dd;border-radius:14px;padding:14px;margin-top:10px;background:#fff}
        details.office-staff-group>summary h3{margin:0;color:#174b3e;font-size:16px;line-height:1.2}
        details.office-staff-group>summary strong{margin-left:auto;font-size:11px;color:#71817c}
        details.office-staff-group>.people-grid{margin-top:14px}
        @media(max-width:620px){details.regional-staff-group>summary{padding:14px 16px}details.regional-staff-group>summary h2{font-size:19px}details.office-staff-group{padding:13px}}
      `}</style>
      <div className="user-toolbar">
        <div>
          <strong>{users.length}</strong>
          <span>Active users</span>
        </div>
        <Button
          className="add-button"
          onClick={() => {
            setCreateError("");
            setAddOpen(true);
          }}
        >
          <Plus />
          Add user
        </Button>
      </div>
      <section className="regional-staff-group leadership-group">
        <header>
          <div><span>LEADERSHIP</span><h2>Regional Heads</h2></div>
          <strong>{users.filter((user: User) => user.role === "Manager").length} heads</strong>
        </header>
        <div className="people-grid">
          {users.filter((user: User) => user.role === "Manager").map((u: User) => (
            <article key={u.name}>
              <div className="person-top"><span className="large-avatar">{u.initials}</span><span className="status">Regional Head</span></div>
              <h2>{u.name}</h2>
              <p>Head · No regional allocation</p>
              <div className="user-card-actions">
                <Button variant="outline" onClick={() => setSelected(u)}>View profile</Button>
                <Button variant="outline" onClick={() => setManaging(u)}>Manage user</Button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <div className="regional-staff-groups">
        {Object.entries(REGION_OFFICES).map(([region, offices]) => {
          const regionUsers = users.filter((user: User) => {
            if (user.role === "Manager") return false;
            const record = staffManagement.find(
              (item: StaffManagementRecord) =>
                item.profileId === user.profileId,
            );
            return staffRegion(record) === region;
          });
          return (
            <details className="regional-staff-group" key={region} open>
              <summary>
                <div>
                  <span>REGION</span>
                  <h2>{region}</h2>
                </div>
                <strong>{regionUsers.length} staff</strong>
              </summary>
              <div className="office-staff-groups">
                {[...offices, "Unassigned"].map((office) => {
                  const officeUsers = regionUsers.filter((user: User) => {
                    const record = staffManagement.find(
                      (item: StaffManagementRecord) =>
                        item.profileId === user.profileId,
                    );
                    return (record?.office || "Unassigned") === office;
                  });
                  if (!officeUsers.length) return null;
                  return (
                    <details className="office-staff-group" key={office}>
                      <summary><h3>{office}</h3><strong>{officeUsers.length} staff</strong></summary>
                      <div className="people-grid">
                        {officeUsers.map((u: User) => (
                          <article key={u.name}>
                            <div className="person-top">
                              <span className="large-avatar">{u.initials}</span>
                              <span
                                className={
                                  tasks.some(
                                    (t: Task) =>
                                      getProfileAssignees(users, u).includes(
                                        t.assignee,
                                      ) &&
                                      t.priority === "Urgent" &&
                                      !t.done,
                                  )
                                    ? "status busy"
                                    : "status"
                                }
                              >
                                {tasks.some(
                                  (t: Task) =>
                                    getProfileAssignees(users, u).includes(
                                      t.assignee,
                                    ) &&
                                    t.priority === "Urgent" &&
                                    !t.done,
                                )
                                  ? "Urgent work"
                                  : "On track"}
                              </span>
                            </div>
                            <h2>{u.name}</h2>
                            <p>{u.role} · Regional Rentals</p>
                            {u.role !== "Manager" && u.linkedTo && (
                              <span className="linked-label">
                                <Users />
                                Linked to{" "}
                                {
                                  users.find(
                                    (x: User) => x.short === u.linkedTo,
                                  )?.short
                                }
                              </span>
                            )}
                            <div className="person-numbers">
                              <span>
                                <strong>
                                  {
                                    tasks.filter(
                                      (t: Task) =>
                                        getProfileAssignees(users, u).includes(
                                          t.assignee,
                                        ) && !t.done,
                                    ).length
                                  }
                                </strong>{" "}
                                open
                              </span>
                              <span>
                                <strong>
                                  {
                                    tasks.filter(
                                      (t: Task) =>
                                        getProfileAssignees(users, u).includes(
                                          t.assignee,
                                        ) && t.done,
                                    ).length
                                  }
                                </strong>{" "}
                                done
                              </span>
                            </div>
                            <div className="user-card-actions">
                              <Button
                                variant="outline"
                                onClick={() => setSelected(u)}
                              >
                                View profile and tasks
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setManaging(u)}
                              >
                                Manage user
                              </Button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a new user</DialogTitle>
            <DialogDescription>
              Create an account and choose whether this person uses their own
              profile or shares another person’s profile.
            </DialogDescription>
          </DialogHeader>
          {created ? (
            <div className="code-created">
              <ShieldCheck />
              <p>
                Account created for <strong>{created.name}</strong>
              </p>
              {created.linkedTo && (
                <span className="created-link">
                  Sharing{" "}
                  {users.find((u: User) => u.short === created.linkedTo)?.name}
                  ’s profile
                </span>
              )}
              <span>Access code</span>
              <b>{created.code}</b>
              <small>The WhatsApp activation link works once and expires after 24 hours. Keep the PIN separately for future devices.</small>
              <style>{`.whatsapp-access-button{display:flex!important;margin:18px auto 0!important;gap:8px;align-items:center;justify-content:center}.whatsapp-access-button svg{width:18px!important;height:18px!important;margin:0!important;color:currentColor!important}`}</style>
              <Button
                className="add-button whatsapp-access-button"
                onClick={() => {
                  const rawNumber = String(created.cellphone || "").replace(/\D/g, "");
                  const whatsappNumber = rawNumber.startsWith("0")
                    ? `27${rawNumber.slice(1)}`
                    : rawNumber;
                  const appLink = `${window.location.origin}/?activate=${encodeURIComponent(created.activationToken || "")}`;
                  const message = [
                    `Hi ${created.name},`,
                    "",
                    "Your access to the Pam Golding Rentals Organiser has been created.",
                    "",
                    `Activate the app: ${appLink}`,
                    "",
                    "This private activation link works once and expires after 24 hours. Open it on your phone, then add the app to your home screen.",
                  ].join("\n");
                  window.open(
                    `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
              >
                <MessageCircle />
                Send secure activation link via WhatsApp
              </Button>
            </div>
          ) : (
            <div className="form-grid user-form">
              <label>
                Full name
                <input
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, name: e.target.value })
                  }
                  placeholder="Name and surname"
                />
              </label>
              <label>
                Role
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value })
                  }
                >
                  <option>Agent</option>
                  <option>Assistant</option>
                  <option>Manager</option>
                </select>
              </label>
              <label>
                Pam Golding email
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  placeholder="name@pamgolding.co.za"
                />
              </label>
              <label>
                Cellphone number
                <input
                  value={newUser.cellphone}
                  onChange={(e) =>
                    setNewUser({ ...newUser, cellphone: e.target.value })
                  }
                  placeholder="082 123 4567"
                />
              </label>
              {newUser.role !== "Manager" && <>
                <label>
                  Region
                  <select value={newUser.region} onChange={(e) => setNewUser({ ...newUser, region: e.target.value, office: "" })}>
                    {Object.keys(REGION_OFFICES).map((region) => <option key={region}>{region}</option>)}
                  </select>
                </label>
                <label>
                  Office
                  <select value={newUser.office} onChange={(e) => setNewUser({ ...newUser, office: e.target.value })}>
                    <option value="">Select office</option>
                    {REGION_OFFICES[newUser.region].map((office) => <option key={office}>{office}</option>)}
                  </select>
                </label>
                <fieldset className="profile-link-field assistant-access-field" style={{ gridColumn: "1 / -1", padding: 15, border: "1px solid #cfddd8", borderRadius: 12 }}>
                  <legend>Connect staff</legend>
                  <small>Connected staff can give one another access to selected tasks, maintenance items, renewals and leases. Connecting them does not expose either person's full profile.</small>
                  {users.filter((user: User) => user.role !== "Manager" && user.profileId).map((staff: User) => (
                    <label className="assistant-access-option" key={staff.profileId}>
                      <input
                        type="checkbox"
                        checked={newUser.connectedProfileIds.includes(staff.profileId!)}
                        onChange={(event) => setNewUser({
                          ...newUser,
                          connectedProfileIds: event.target.checked
                            ? [...newUser.connectedProfileIds, staff.profileId!]
                            : newUser.connectedProfileIds.filter((id) => id !== staff.profileId),
                        })}
                      />
                      <span>{staff.name}</span>
                    </label>
                  ))}
                </fieldset>
              </>}
              {createError && <p className="login-error">{createError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                setCreated(null);
                setCreateError("");
              }}
            >
              {created ? "Done" : "Cancel"}
            </Button>
            {!created && (
              <Button
                className="add-button"
                disabled={creating}
                onClick={createUser}
              >
                {creating ? (
                  <>
                    <Loader2 className="spin" />
                    Creating user…
                  </>
                ) : (
                  "Generate access code"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UserManagementDialog
        user={managing}
        setUser={setManaging}
        users={users}
        saveUsers={saveUsers}
        current={current}
        staffConnections={staffConnections}
        setStaffConnections={setStaffConnections}
      />
    </>
  );
}
const REGION_OFFICES: Record<string, string[]> = {
  "Cape Region": [
    "City Bowl",
    "Sea Point",
    "Southern Suburbs",
    "West Coast",
    "Camps Bay",
    "Hout Bay / Fish Hoek / Noordhoek",
  ],
  "B&O": [
    "Paarl",
    "Wellington",
    "Franschhoek",
    "Stellenbosch",
    "Somerset West",
    "Northern Suburbs",
    "Onrus / Hermanus",
    "Betty's Bay",
  ],
};
function staffRegion(record?: StaffManagementRecord) {
  if (record?.region && REGION_OFFICES[record.region]) return record.region;
  const office = record?.office || "";
  return (
    Object.entries(REGION_OFFICES).find(([, offices]) =>
      offices.includes(office),
    )?.[0] || "B&O"
  );
}
function monthDate(month: string) {
  return new Date(`${month}-01T12:00:00`);
}
function periodMatch(
  month: string,
  anchor: string,
  period: string,
  previous = false,
) {
  const date = monthDate(month),
    target = monthDate(anchor);
  if (period === "Monthly") {
    target.setMonth(target.getMonth() - (previous ? 1 : 0));
    return (
      date.getFullYear() === target.getFullYear() &&
      date.getMonth() === target.getMonth()
    );
  }
  if (period === "Quarterly") {
    target.setMonth(target.getMonth() - (previous ? 3 : 0));
    return (
      date.getFullYear() === target.getFullYear() &&
      Math.floor(date.getMonth() / 3) === Math.floor(target.getMonth() / 3)
    );
  }
  target.setFullYear(target.getFullYear() - (previous ? 1 : 0));
  return date.getFullYear() === target.getFullYear();
}
function portfolioTotals(
  records: StaffManagementRecord[],
  anchor: string,
  period: string,
  previous = false,
) {
  return records.reduce(
    (totals, record) => {
      const months = (record.months || []).filter((item) =>
        periodMatch(item.month, anchor, period, previous),
      );
      totals.newProperties += months.reduce(
        (sum, item) => sum + (item.newProperties || 0),
        0,
      );
      totals.leases += months.reduce(
        (sum, item) => sum + (item.totalLeases || 0),
        0,
      );
      totals.leaseValue += months.reduce(
        (sum, item) => sum + (item.totalLeaseValue || 0),
        0,
      );
      return totals;
    },
    { newProperties: 0, leases: 0, leaseValue: 0 },
  );
}
function ManagerReportingView({ users, records, current, onSave }: any) {
  return (
    <div className="manager-reporting-page">
      <ManagerPortfolioInsights users={users} records={records} />
      <RegionalAnnualEntry current={current} records={records} onSave={onSave} />
    </div>
  );
}
function ManagerPortfolioInsights({ users, records }: any) {
  const [scope, setScope] = useState("all"),
    [period, setPeriod] = useState("Monthly"),
    selectedRecords: StaffManagementRecord[] = records.filter(
      (record: StaffManagementRecord) => {
        const owner = users.find((user: User) => user.profileId === record.profileId);
        if (owner?.role === "Manager") return false;
        if (scope === "all") return true;
        if (scope.startsWith("region:"))
          return staffRegion(record) === scope.slice(7);
        if (scope.startsWith("office:"))
          return record.office === scope.slice(7);
        return record.profileId === scope.slice(6);
      },
    ),
    anchor =
      records
        .flatMap((record: StaffManagementRecord) => record.months || [])
        .map((item: any) => item.month)
        .sort()
        .at(-1) || dateKey(0).slice(0, 7),
    currentTotals = portfolioTotals(selectedRecords, anchor, period),
    previousTotals = portfolioTotals(selectedRecords, anchor, period, true),
    propertyChange = currentTotals.newProperties - previousTotals.newProperties,
    leaseChange = currentTotals.leases - previousTotals.leases,
    valueChange = currentTotals.leaseValue - previousTotals.leaseValue,
    insight = !selectedRecords.some((record) => record.months?.length)
      ? "Add monthly figures to staff profiles to generate regional, office and individual insights."
      : currentTotals.newProperties === 0
        ? `No new properties were recorded for this ${period.toLowerCase()} period. Compare offices and set focused prospecting targets.`
        : propertyChange < 0
          ? `New property growth is ${Math.abs(propertyChange)} below the previous period. Review lead sources and the strongest-performing office.`
          : `This selection added ${currentTotals.newProperties} new properties and completed ${currentTotals.leases} total leases. Continue the activity producing the best lease value.`;
  const currency = new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  });
  return (
    <section className="manager-insights-panel">
      <header>
        <div>
          <span>AI PORTFOLIO INSIGHTS</span>
          <h2>Growth and coaching overview</h2>
        </div>
        <div className="manager-report-filters">
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            aria-label="Reporting group"
          >
            <option value="all">All regions combined</option>
            {Object.entries(REGION_OFFICES).map(([region, offices]) => (
              <optgroup label={region} key={region}>
                <option value={`region:${region}`}>{region} total</option>
                {offices.map((office) => (
                  <option value={`office:${office}`} key={office}>
                    {office}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Individual staff">
              {users
                .filter((user: User) => user.profileId && user.role !== "Manager")
                .map((user: User) => (
                  <option
                    key={user.profileId}
                    value={`staff:${user.profileId}`}
                  >
                    {user.name}
                  </option>
                ))}
            </optgroup>
          </select>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            aria-label="Comparison period"
          >
            <option>Monthly</option>
            <option>Quarterly</option>
            <option>Yearly</option>
          </select>
        </div>
      </header>
      <div className="report-period-label">
        <span>{period.toUpperCase()} REPORT</span>
        <strong>
          Current period compared with previous{" "}
          {period.toLowerCase().replace("ly", "")}
        </strong>
      </div>
      <div className="manager-insight-stats">
        <article>
          <strong>{currentTotals.newProperties}</strong>
          <span>New properties</span>
        </article>
        <article>
          <strong>{currentTotals.leases}</strong>
          <span>Total leases</span>
        </article>
        <article>
          <strong>{currency.format(currentTotals.leaseValue)}</strong>
          <span>Total lease value</span>
        </article>
        <article className={propertyChange < 0 ? "negative" : ""}>
          <strong>
            {propertyChange > 0 ? "+" : ""}
            {propertyChange}
          </strong>
          <span>New properties vs previous</span>
        </article>
        <article className={leaseChange < 0 ? "negative" : ""}>
          <strong>
            {leaseChange > 0 ? "+" : ""}
            {leaseChange}
          </strong>
          <span>Total leases vs previous</span>
        </article>
        <article className={valueChange < 0 ? "negative" : ""}>
          <strong>
            {valueChange > 0 ? "+" : ""}
            {currency.format(valueChange)}
          </strong>
          <span>Lease value vs previous</span>
        </article>
      </div>
      <div className="manager-ai-advice">
        <Sparkles />
        <p>{insight}</p>
      </div>
    </section>
  );
}
function RegionalAnnualEntry({ current, records, onSave }: any) {
  const now = new Date(), startYear = now.getMonth() + 1 >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const managerRecord: StaffManagementRecord | undefined = records.find(
    (item: StaffManagementRecord) => item.profileId === current?.profileId,
  );
  const finalYear = Math.max(startYear + 2, 2027),
    yearOptions = Array.from({ length: finalYear - 2023 }, (_, index) => {
      const first = 2024 + index;
      return `${first}/${first + 1}`;
    }),
    savedAnnualTotals = managerRecord?.regionalAnnualTotals || [],
    regionalHistory = (["B&O", "Cape Region"] as const).map((region) => ({
      region,
      rows: savedAnnualTotals
        .filter((item) => item.region === region)
        .sort((a, b) => a.year.localeCompare(b.year)),
    }));
  const [year, setYear] = useState(`${startYear}/${startYear + 1}`),
    [bnoLeases, setBnoLeases] = useState(0),
    [bnoValue, setBnoValue] = useState(0),
    [capeLeases, setCapeLeases] = useState(0),
    [capeValue, setCapeValue] = useState(0),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const selectYear = (nextYear: string) => {
    setYear(nextYear);
    const totals = managerRecord?.regionalAnnualTotals || [];
    const bno = totals.find((item) => item.year === nextYear && item.region === "B&O");
    const cape = totals.find((item) => item.year === nextYear && item.region === "Cape Region");
    setBnoLeases(bno?.leasesConcluded || 0);
    setBnoValue(bno?.totalLeaseValue || 0);
    setCapeLeases(cape?.leasesConcluded || 0);
    setCapeValue(cape?.totalLeaseValue || 0);
    setMessage("");
  };
  useEffect(() => { selectYear(year); }, [managerRecord?.updatedAt]);
  const saveAnnualTotals = async () => {
    if (!current?.profileId) return;
    setSaving(true);
    setMessage("");
    const base: StaffManagementRecord = managerRecord || {
      profileId: current.profileId,
      region: "B&O",
      office: "",
      managerProfileId: "arno-and-melissa",
      strengths: "",
      developmentAreas: "",
      issues: "",
      coachingPlan: "",
      months: [],
    };
    const otherYears = (base.regionalAnnualTotals || []).filter((item) => item.year !== year);
    const next = {
      ...base,
      regionalAnnualTotals: [
        ...otherYears,
        { year, region: "B&O" as const, leasesConcluded: bnoLeases, totalLeaseValue: bnoValue },
        { year, region: "Cape Region" as const, leasesConcluded: capeLeases, totalLeaseValue: capeValue },
      ],
    };
    try {
      await onSave(next);
      setMessage("Regional annual totals saved.");
    } catch (error: any) {
      setMessage(error?.message || "Regional totals could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return <><style>{`
    .manager-reporting-page{display:grid;gap:22px}
    .regional-annual-entry{display:block;margin:0 0 18px;padding:18px;border:1px solid #c8ddd5;border-radius:16px;background:#f4f9f7;overflow:hidden}
    .regional-annual-entry>header{display:block;margin:0 0 15px;padding:0;background:transparent;box-shadow:none}
    .regional-annual-entry>header span{color:#08705a;font-size:9px;font-weight:850;letter-spacing:.1em}
    .regional-annual-entry h2{margin:5px 0;color:#173d33;font:700 22px Georgia,serif}
    .regional-annual-entry header p{margin:0;color:#688078;font-size:12px;line-height:1.5}
    .regional-annual-entry label{display:block;color:#31584b;font-size:11px;font-weight:800}
    .regional-annual-entry input,.regional-annual-entry select{display:block;box-sizing:border-box;width:100%;height:46px;margin:7px 0 0;padding:10px 12px;border:1px solid #c8d9d3;border-radius:10px;background:#fff;color:#173d33;font:700 14px Inter,Arial,sans-serif}
    .regional-year{max-width:280px;margin:0 0 14px}
    .regional-annual-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin:0 0 14px}
    .regional-annual-grid article{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:15px;border:1px solid #d2e1dc;border-radius:13px;background:#fff}
    .regional-annual-grid h3,.regional-annual-grid article>small{grid-column:1/-1}
    .regional-annual-grid h3{margin:0;color:#16483b;font:700 19px Georgia,serif}
    .regional-annual-grid article>small{margin:-8px 0 0;color:#71817c;font-size:10px}
    .regional-annual-entry>.add-button{min-height:48px}
    .regional-save-message{margin:10px 0 0;color:#08705a;font-size:11px;font-weight:750}
    .annual-entry-divider{margin:22px 0 14px;padding:20px 0 0;border-top:1px solid #cbded7}
    .annual-entry-divider span{display:block;color:#08705a;font-size:9px;font-weight:850;letter-spacing:.1em}
    .annual-entry-divider h3{margin:6px 0 5px;color:#173d33;font:700 22px Georgia,serif;line-height:1.2}
    .annual-entry-divider p{margin:0;color:#688078;font-size:12px;line-height:1.5}
    .regional-year-overview{display:grid;gap:12px;margin-top:18px;padding-top:18px;border-top:1px solid #cbded7}
    .regional-year-overview>header h3{margin:4px 0;color:#173d33;font:700 20px Georgia,serif}
    .regional-year-overview>header span{color:#08705a;font-size:9px;font-weight:850;letter-spacing:.1em}
    .regional-year-history{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .regional-year-history>section{padding:14px;border:1px solid #d2e1dc;border-radius:12px;background:#fff}
    .regional-year-history h4{margin:0 0 10px;color:#16483b;font:700 18px Georgia,serif}
    .regional-year-row{display:grid;grid-template-columns:72px 1fr;gap:7px 10px;padding:10px 0;border-top:1px solid #e2ebe7}
    .regional-year-row:first-of-type{border-top:0}
    .regional-year-row>b{grid-row:1/3;color:#173d33;font-size:12px}
    .regional-year-row strong{color:#173d33;font-size:13px}
    .regional-year-row>span{color:#647b73;font-size:10px}
    .regional-change{grid-column:1/-1;margin-top:3px;padding:8px 9px;border-radius:8px;background:#edf7f3;color:#08705a!important;font-weight:800}
    .regional-change.negative{background:#fff1f3;color:#b51f37!important}
    .portfolio-comparison-row article:not(:last-child) strong{font-size:16px}
    .portfolio-comparison-row article:last-child{grid-column:1/-1;padding:18px;border-left-width:6px}
    .portfolio-comparison-row article:last-child strong{font-size:23px;line-height:1.22}
    .comparison-value-result{color:#31584b!important;font-size:12px!important;font-weight:800}
    @media(max-width:620px){
      .regional-annual-entry{padding:15px}
      .regional-year{max-width:none}
      .regional-annual-grid{grid-template-columns:1fr;gap:12px}
      .regional-annual-grid article{grid-template-columns:1fr;gap:12px;padding:14px}
      .regional-annual-grid h3,.regional-annual-grid article>small{grid-column:auto}
      .regional-annual-entry>.add-button{width:100%}
      .regional-year-history{grid-template-columns:1fr}
      .annual-entry-divider{margin-top:18px;padding-top:17px}
      .annual-entry-divider h3{font-size:20px}
      .portfolio-comparison-row article:last-child strong{font-size:20px}
    }
  `}</style><section className="regional-annual-entry">
    <header><div><span>MANAGER REPORTING</span><h2>Regional performance history</h2><p>Compare every saved reporting year for B&amp;O and the Cape Region.</p></div></header>
    <div className="regional-year-overview">
      <div className="regional-year-history">
        {regionalHistory.map(({ region, rows }) => <section key={region}><h4>{region}</h4>{rows.length ? rows.map((item, index) => {
          const previous = rows[index - 1], leaseChange = previous ? item.leasesConcluded - previous.leasesConcluded : 0, valueChange = previous ? item.totalLeaseValue - previous.totalLeaseValue : 0;
          return <div className="regional-year-row" key={item.year}><b>{item.year}</b><strong>{item.leasesConcluded} leases concluded</strong><span>{new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(item.totalLeaseValue || 0)} total lease value</span>{previous && <span className={`regional-change ${leaseChange < 0 || valueChange < 0 ? "negative" : ""}`}>Leases {leaseChange >= 0 ? "increased" : "decreased"} by {Math.abs(leaseChange)} · Value {valueChange >= 0 ? "increased" : "decreased"} by {new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(Math.abs(valueChange))}</span>}</div>;
        }) : <p>No annual totals saved yet.</p>}</section>)}
      </div>
    </div>
    <div className="annual-entry-divider"><span>ADD OR UPDATE A REPORTING YEAR</span><h3>Annual regional totals</h3><p>Enter the confirmed totals for all agents in each region.</p></div>
    <label className="regional-year">Reporting year<select value={year} onChange={(e) => selectYear(e.target.value)}>{yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    <div className="regional-annual-grid">
      <article><h3>B&amp;O</h3><small>Includes Overberg</small><label>Total leases concluded<input type="number" min="0" value={bnoLeases} onChange={(e) => setBnoLeases(Number(e.target.value))} /></label><label>Total lease value<input type="number" min="0" step="100" value={bnoValue} onChange={(e) => setBnoValue(Number(e.target.value))} /></label></article>
      <article><h3>Cape Region</h3><small>All Cape agents</small><label>Total leases concluded<input type="number" min="0" value={capeLeases} onChange={(e) => setCapeLeases(Number(e.target.value))} /></label><label>Total lease value<input type="number" min="0" step="100" value={capeValue} onChange={(e) => setCapeValue(Number(e.target.value))} /></label></article>
    </div>
    <Button className="add-button" disabled={saving || !year.trim()} onClick={saveAnnualTotals}>{saving ? "Saving…" : "Save annual regional totals"}</Button>
    {message && <p className="regional-save-message">{message}</p>}
  </section></>;
}
function StaffPerformancePanel({ user, users, record, onSave }: any) {
  const isAssistant = String(user.role || "").toLowerCase() === "assistant";
  const emptyRecord: StaffManagementRecord = {
      profileId: user.profileId,
      region: "B&O",
      office: "",
      managerProfileId: "arno-and-melissa",
      strengths: "",
      developmentAreas: "",
      issues: "",
      coachingPlan: "",
      months: [],
    },
    [draft, setDraft] = useState<StaffManagementRecord>(record || emptyRecord),
    [month, setMonth] = useState({
      month: dateKey(0).slice(0, 7),
      newProperties: 0,
      introNewProperties: 0,
      managedNewProperties: 0,
      newTenantLeases: 0,
      introNewTenantLeases: 0,
      managedNewTenantLeases: 0,
      leaseRenewals: 0,
      introRenewals: 0,
      managedRenewals: 0,
      totalLeases: 0,
      totalLeaseValue: 0,
      currentPortfolioProperties: 0,
      currentPortfolioLeaseValue: 0,
    }),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setDraft(record || { ...emptyRecord, profileId: user.profileId });
  }, [user.profileId, record?.updatedAt]);
  const months = [...draft.months].sort((a, b) =>
      b.month.localeCompare(a.month),
    ),
    latest = months[0],
    previous = months[1],
    selectedCalendarYear = Number(month.month.slice(0, 4)),
    selectedCalendarMonth = Number(month.month.slice(5, 7)),
    reportingYearStart =
      selectedCalendarMonth >= 3
        ? selectedCalendarYear
        : selectedCalendarYear - 1,
    reportingYearEnd = reportingYearStart + 1,
    reportingPeriodStart = `${reportingYearStart}-03`,
    reportingPeriodEnd = `${reportingYearEnd}-02`,
    reportingYearLabel = `${reportingYearStart}/${reportingYearEnd}`,
    yearMonths = months.filter(
      (item) =>
        item.month >= reportingPeriodStart && item.month <= reportingPeriodEnd,
    ),
    currentQuarter = Math.floor((Number(month.month.slice(5, 7)) - 1) / 3),
    quarterMonths = yearMonths.filter(
      (item) =>
        Math.floor((Number(item.month.slice(5, 7)) - 1) / 3) === currentQuarter,
    ),
    february2025 = months.find((item) => item.month === "2025-02"),
    february2026 = months.find((item) => item.month === "2026-02"),
    advice = !latest
      ? "Add the first monthly portfolio record to generate coaching guidance."
      : latest.newProperties === 0
        ? "No new properties were recorded this month. Set weekly prospecting and landlord-contact targets."
        : latest.totalLeases === 0
          ? "New properties were added, but no leases were recorded. Review new-tenant and renewal activity."
          : "New properties and leases were recorded. Identify the strongest lead source and repeat it consistently next month.";
  const yearOnYearLeaseChange =
      (february2026?.currentPortfolioProperties || 0) -
      (february2025?.currentPortfolioProperties || 0),
    yearOnYearValueChange =
      (february2026?.currentPortfolioLeaseValue || 0) -
      (february2025?.currentPortfolioLeaseValue || 0);
  const save = async (next = draft) => {
    setSaving(true);
    setMessage("");
    try {
      await onSave(next);
      setDraft(next);
      setMessage("Manager record saved securely.");
    } catch (error: any) {
      setMessage(error?.message || "The manager record could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const selectMonth = (selectedMonth: string) => {
    const existing = draft.months.find((item) => item.month === selectedMonth);
    setMonth(
      existing
        ? {
            ...existing,
            introNewProperties: existing.introNewProperties ?? 0,
            managedNewProperties:
              existing.managedNewProperties ?? existing.newProperties ?? 0,
            newTenantLeases:
              existing.newTenantLeases ?? existing.totalLeases ?? 0,
            introNewTenantLeases: existing.introNewTenantLeases ?? 0,
            managedNewTenantLeases:
              existing.managedNewTenantLeases ??
              existing.newTenantLeases ??
              existing.totalLeases ??
              0,
            leaseRenewals: existing.leaseRenewals ?? 0,
            introRenewals: existing.introRenewals ?? 0,
            managedRenewals:
              existing.managedRenewals ?? existing.leaseRenewals ?? 0,
            currentPortfolioProperties:
              existing.currentPortfolioProperties ?? 0,
            currentPortfolioLeaseValue:
              existing.currentPortfolioLeaseValue ??
              existing.totalLeaseValue ??
              0,
          }
        : {
        month: selectedMonth,
        newProperties: 0,
        introNewProperties: 0,
        managedNewProperties: 0,
        newTenantLeases: 0,
        introNewTenantLeases: 0,
        managedNewTenantLeases: 0,
        leaseRenewals: 0,
        introRenewals: 0,
        managedRenewals: 0,
        totalLeases: 0,
        totalLeaseValue: 0,
        currentPortfolioProperties: 0,
        currentPortfolioLeaseValue: 0,
          },
    );
    setMessage("");
  };
  const saveMonth = () => {
    if (month.month !== "2025-02" && month.month < "2026-02") {
      setMessage(
        "Choose February 2025, February 2026, or a month after February 2026.",
      );
      return;
    }
    const newProperties =
        Number(month.introNewProperties || 0) +
        Number(month.managedNewProperties || 0),
      newTenantLeases =
        Number(month.introNewTenantLeases || 0) +
        Number(month.managedNewTenantLeases || 0),
      leaseRenewals =
        Number(month.introRenewals || 0) +
        Number(month.managedRenewals || 0),
      monthlyTotalLeases = newTenantLeases + leaseRenewals;
    const next = {
      ...draft,
      months: [
        ...draft.months.filter((item) => item.month !== month.month),
        {
          ...month,
          newProperties,
          newTenantLeases,
          leaseRenewals,
          totalLeases: monthlyTotalLeases,
        },
      ],
    };
    void save(next);
  };
  const currency = (value: number) =>
    new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      maximumFractionDigits: 0,
    }).format(value || 0);
  return (
    <section className="staff-performance-panel">
      <header>
        <div>
          <span>MANAGER ONLY</span>
          <h2>Staff performance and portfolio</h2>
          <p>
            {isAssistant
              ? "Private staff support, development and coaching information."
              : "Private coaching information and manually confirmed monthly figures."}
          </p>
        </div>
        <Button
          className="add-button"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save manager notes"}
        </Button>
      </header>
      <div className="staff-assignment-grid">
        <label>
          Region
          <select
            value={draft.region || staffRegion(draft)}
            onChange={(e) =>
              setDraft({ ...draft, region: e.target.value, office: "" })
            }
          >
            {Object.keys(REGION_OFFICES).map((region) => (
              <option key={region}>{region}</option>
            ))}
          </select>
        </label>
        <label>
          Office
          <select
            value={draft.office}
            onChange={(e) => setDraft({ ...draft, office: e.target.value })}
          >
            <option value="">Choose office</option>
            {REGION_OFFICES[draft.region || staffRegion(draft)].map(
              (office) => (
                <option key={office}>{office}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Reports to
          <div className="reports-to-value">
            <Users aria-hidden="true" />
            <span>Arno de Wit and Melissa Slabber</span>
          </div>
        </label>
      </div>
      <div className="staff-coaching-grid">
        <label>
          Strengths
          <textarea
            value={draft.strengths}
            onChange={(e) => setDraft({ ...draft, strengths: e.target.value })}
            placeholder="Record strengths and positive performance..."
          />
        </label>
        <label>
          Development areas
          <textarea
            value={draft.developmentAreas}
            onChange={(e) =>
              setDraft({ ...draft, developmentAreas: e.target.value })
            }
            placeholder="Skills or behaviours to develop..."
          />
        </label>
        <label>
          Issues experienced
          <textarea
            value={draft.issues}
            onChange={(e) => setDraft({ ...draft, issues: e.target.value })}
            placeholder="Record the issue, date and action taken..."
          />
        </label>
        <label>
          Coaching plan
          <textarea
            value={draft.coachingPlan}
            onChange={(e) =>
              setDraft({ ...draft, coachingPlan: e.target.value })
            }
            placeholder="Agreed actions, support and follow-up date..."
          />
        </label>
      </div>
      {!isAssistant && (
        <>
      <div className="portfolio-entry">
        <div>
          <span>MONTHLY PORTFOLIO RECORD</span>
          <h3>Enter each agent’s total statistics</h3>
          <p>
            Start with the February 2025 and February 2026 benchmarks, then
            capture every month from March 2026 onward.
          </p>
        </div>
        <div className="portfolio-month-shortcuts">
          <button
            className={month.month === "2025-02" ? "selected" : ""}
            onClick={() => selectMonth("2025-02")}
          >
            February 2025 baseline
          </button>
          <button
            className={month.month === "2026-02" ? "selected" : ""}
            onClick={() => selectMonth("2026-02")}
          >
            February 2026 comparison
          </button>
        </div>
        <label className="portfolio-month-field">
          Month
          <input
            type="month"
            value={month.month}
            onChange={(e) => selectMonth(e.target.value)}
          />
          <small>
            Use March 2026, April 2026 and every month going forward.
          </small>
        </label>
        <div className="monthly-reporting-table">
          <div className="monthly-reporting-head">
            <strong>Monthly reporting</strong>
            <span>Intro</span>
            <span>Managed</span>
          </div>
          <div className="monthly-reporting-row">
            <strong>New properties</strong>
            <label>
              <span>Intro new properties</span>
              <input
                aria-label="Intro new properties"
                type="number"
                min="0"
                value={month.introNewProperties}
                onChange={(e) =>
                  setMonth({ ...month, introNewProperties: Number(e.target.value) })
                }
              />
            </label>
            <label>
              <span>Managed new properties</span>
              <input
                aria-label="Managed new properties"
                type="number"
                min="0"
                value={month.managedNewProperties}
                onChange={(e) =>
                  setMonth({ ...month, managedNewProperties: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="monthly-reporting-row">
            <strong>New tenant leases</strong>
            <label>
              <span>Intro new tenant leases</span>
              <input
                aria-label="Intro new tenant leases"
                type="number"
                min="0"
                value={month.introNewTenantLeases}
                onChange={(e) =>
                  setMonth({ ...month, introNewTenantLeases: Number(e.target.value) })
                }
              />
            </label>
            <label>
              <span>Managed new tenant leases</span>
              <input
                aria-label="Managed new tenant leases"
                type="number"
                min="0"
                value={month.managedNewTenantLeases}
                onChange={(e) =>
                  setMonth({ ...month, managedNewTenantLeases: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="monthly-reporting-row">
            <strong>Renewals</strong>
            <label>
              <span>Intro renewals</span>
              <input
                aria-label="Intro renewals"
                type="number"
                min="0"
                value={month.introRenewals}
                onChange={(e) =>
                  setMonth({ ...month, introRenewals: Number(e.target.value) })
                }
              />
            </label>
            <label>
              <span>Managed renewals</span>
              <input
                aria-label="Managed renewals"
                type="number"
                min="0"
                value={month.managedRenewals}
                onChange={(e) =>
                  setMonth({ ...month, managedRenewals: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </div>
        <label className="monthly-total-lease-value">
          Total combined lease value for this month (R)
          <input
            type="number"
            min="0"
            step="100"
            value={month.totalLeaseValue}
            onChange={(e) =>
              setMonth({ ...month, totalLeaseValue: Number(e.target.value) })
            }
          />
          <small>
            Include all Intro and Managed new properties, new tenant leases and renewals.
          </small>
        </label>
        <Button
          className="add-button"
          disabled={!month.month || saving}
          onClick={saveMonth}
        >
          Save monthly figures
        </Button>
      </div>
      <div className="portfolio-overview-group">
        <div className="portfolio-overview-heading">
          <span>FEBRUARY COMPARISON</span>
          <h3>Year-on-year portfolio overview</h3>
        </div>
        <div className="portfolio-summary-grid portfolio-comparison-row">
        <article>
          <small>FEBRUARY 2025 BASELINE</small>
          <strong>{february2025?.currentPortfolioProperties || 0} leases</strong>
          <span>
            {currency(february2025?.currentPortfolioLeaseValue || 0)} portfolio lease value
          </span>
        </article>
        <article>
          <small>FEBRUARY 2026 TOTAL</small>
          <strong>{february2026?.currentPortfolioProperties || 0} leases</strong>
          <span>
            {currency(february2026?.currentPortfolioLeaseValue || 0)} portfolio lease value
          </span>
        </article>
        <article
          className={
            yearOnYearLeaseChange < 0 || yearOnYearValueChange < 0
              ? "negative"
              : "positive"
          }
        >
          <small>YEAR-ON-YEAR RESULT</small>
          <strong>
            Portfolio {yearOnYearLeaseChange >= 0 ? "increased" : "decreased"} by {Math.abs(yearOnYearLeaseChange)} leases
          </strong>
          <span className="comparison-value-result">
            Lease value {yearOnYearValueChange >= 0 ? "increased" : "decreased"} by {currency(Math.abs(yearOnYearValueChange))}
          </span>
        </article>
        </div>
      </div>
      <div className="portfolio-overview-group">
        <div className="portfolio-overview-heading">
          <span>{reportingYearLabel} YEAR TO DATE</span>
          <h3>Current-year performance</h3>
        </div>
        <div className="portfolio-summary-grid portfolio-ytd-row">
        <article>
          <small>TOTAL NEW PROPERTIES</small>
          <strong>
            {yearMonths.reduce(
              (sum, item) => sum + (item.newProperties || 0),
              0,
            )}
          </strong>
          <span>brand-new properties added this year</span>
        </article>
        <article>
          <small>TOTAL LEASES CONCLUDED</small>
          <strong>
            {yearMonths.reduce(
              (sum, item) => sum + (item.totalLeases || 0),
              0,
            )}
          </strong>
          <span>renewals and new-tenant leases this year</span>
        </article>
        <article>
          <small>TOTAL LEASE VALUE YEAR TO DATE</small>
          <strong>
            {currency(
              yearMonths.reduce(
                (sum, item) => sum + (item.totalLeaseValue || 0),
                0,
              ),
            )}
          </strong>
          <span>combined value of all monthly Intro and Managed activity</span>
        </article>
        </div>
      </div>
      <div className="manager-advice">
        <Sparkles />
        <div>
          <span>PORTFOLIO GROWTH GUIDANCE</span>
          <p>{advice}</p>
        </div>
      </div>
      {months.length > 0 && (
        <div className="portfolio-history">
          <h3>Monthly history</h3>
          {months.map((item) => (
            <article key={item.month}>
              <strong>{item.month}</strong>
              <span>{item.newProperties || 0} new properties</span>
              <span>
                {item.totalLeases || 0} total leases ({item.newTenantLeases || 0} new tenants · {item.leaseRenewals || 0} renewals)
              </span>
              <b>{currency(item.totalLeaseValue || 0)}</b>
            </article>
          ))}
        </div>
      )}
        </>
      )}
      {message && <p className="staff-save-message">{message}</p>}
    </section>
  );
}
function UserManagementDialog({
  user,
  setUser,
  users,
  saveUsers,
  current,
  staffConnections,
  setStaffConnections,
}: any) {
  const [draft, setDraft] = useState({
      name: "",
      role: "Agent",
      email: "",
      cellphone: "",
      connectedProfileIds: [] as string[],
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [newCode, setNewCode] = useState("");
  useEffect(() => {
    if (user) {
      setDraft({
        name: user.name,
        role: user.role,
        email: user.email || "",
        cellphone: user.cellphone || "",
        connectedProfileIds: (staffConnections || [])
          .filter((link: StaffConnection) => link.profileAId === user.profileId || link.profileBId === user.profileId)
          .map((link: StaffConnection) => link.profileAId === user.profileId ? link.profileBId : link.profileAId),
      });
      setError("");
      setNewCode("");
    }
  }, [user, staffConnections]);
  if (!user) return null;
  const save = async () => {
    if (!draft.name.trim() || !user.profileId) return;
    setBusy(true);
    setError("");
    try {
      const row: any = await updateStaffProfile({
          profileId: user.profileId,
          name: draft.name,
          role: draft.role.toLowerCase() as "manager" | "agent" | "assistant",
          email: draft.email,
          cellphone: draft.cellphone,
        }),
        updated: User = {
          ...user,
          name: row.full_name,
          short: row.short_name,
          initials: row.initials,
          role:
            row.role === "manager"
              ? "Manager"
              : row.role === "assistant"
                ? "Assistant"
                : "Agent",
          email: row.email || "",
          cellphone: row.cellphone || "",
          teamId: row.team_id,
        };
      if (updated.role !== "Manager") {
        const previousIds = (staffConnections || [])
          .filter((link: StaffConnection) => link.profileAId === user.profileId || link.profileBId === user.profileId)
          .map((link: StaffConnection) => link.profileAId === user.profileId ? link.profileBId : link.profileAId);
        await saveStaffConnections(user.profileId, draft.connectedProfileIds);
        setStaffConnections((links: StaffConnection[]) => [
          ...links.filter((link) => link.profileAId !== user.profileId && link.profileBId !== user.profileId),
          ...draft.connectedProfileIds.map((otherId: string) => {
            const [profileAId, profileBId] = [user.profileId, otherId].sort();
            return { profileAId, profileBId };
          }),
        ]);
        const newlyGranted = draft.connectedProfileIds.filter(
          (id: string) => !previousIds.includes(id),
        );
        if (newlyGranted.length && updated.teamId) {
          const names = users
            .filter((agent: User) => agent.profileId && newlyGranted.includes(agent.profileId))
            .map((agent: User) => agent.name)
            .join(", ");
          await createTeamNotifications([{
            recipientProfileId: user.profileId,
            teamId: updated.teamId,
            message: `Task-status access granted for: ${names}.`,
            section: "Tasks & To-do",
          }]);
        }
      }
      saveUsers(
        users.map((u: User) => (u.profileId === user.profileId ? updated : u)),
      );
      setUser(null);
    } catch (e: any) {
      setError(
        e?.message?.includes("three active")
          ? "That team already has three active staff members."
          : e?.message || "The changes could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const resetCode = async () => {
    if (!user.profileId) return;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setBusy(true);
    setError("");
    try {
      await resetStaffAccessCode(user.profileId, code);
      saveUsers(
        users.map((u: User) =>
          u.profileId === user.profileId ? { ...u, code } : u,
        ),
      );
      setNewCode(code);
    } catch (e: any) {
      setError(e?.message || "A new code could not be generated.");
    } finally {
      setBusy(false);
    }
  };
  const deactivate = async () => {
    if (
      !user.profileId ||
      !window.confirm(
        `Deactivate ${user.name}? They will immediately lose access, but their work will remain saved.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await deactivateStaffProfile(user.profileId);
      saveUsers(users.filter((u: User) => u.profileId !== user.profileId));
      setUser(null);
    } catch (e: any) {
      setError(e?.message || "The user could not be deactivated.");
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(open) => !open && setUser(null)}
    >
      <DialogContent className="task-dialog">
        <DialogHeader>
          <DialogTitle>Manage {user.name}</DialogTitle>
          <DialogDescription>
            Update this user’s details, staff connections or login code.
          </DialogDescription>
        </DialogHeader>
        {newCode ? (
          <div className="code-created">
            <ShieldCheck />
            <p>
              New access code generated for <strong>{user.name}</strong>
            </p>
            <span>New access code</span>
            <b>{newCode}</b>
            <small>
              Copy this code now. Their previous code and signed-in devices no
              longer work.
            </small>
          </div>
        ) : (
          <div className="form-grid user-form">
            <style>{`.assistant-access-field{grid-column:1/-1;margin:4px 0;padding:15px;border:1px solid #cfddd8;border-radius:12px}.assistant-access-field legend{padding:0 6px;color:#174b3e;font-size:12px;font-weight:800}.assistant-access-field>small{display:block;margin:0 0 10px;color:#71817c;font-size:10px;line-height:1.45}.assistant-access-option{display:flex!important;align-items:center;gap:9px;margin:7px 0!important;padding:9px 10px;border-radius:8px;background:#f2f7f5}.assistant-access-option input{width:17px!important;height:17px!important;margin:0!important}.assistant-access-option span{font-size:12px;font-weight:750;color:#284f43}`}</style>
            <label>
              Full name
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Role
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              >
                <option>Agent</option>
                <option>Assistant</option>
                <option>Manager</option>
              </select>
            </label>
            <label>
              Pam Golding email
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </label>
            <label>
              Cellphone number
              <input
                value={draft.cellphone}
                onChange={(e) =>
                  setDraft({ ...draft, cellphone: e.target.value })
                }
              />
            </label>
            {draft.role !== "Manager" && (
              <fieldset className="assistant-access-field">
                <legend>Connected staff</legend>
                <small>Connected staff can mutually share selected work items. Their full profiles remain private.</small>
                {users.filter((person: User) => person.role !== "Manager" && person.profileId && person.profileId !== user.profileId).map((staff: User) => (
                  <label className="assistant-access-option" key={staff.profileId}>
                    <input
                      type="checkbox"
                      checked={draft.connectedProfileIds.includes(staff.profileId!)}
                      onChange={(event) => setDraft({
                        ...draft,
                        connectedProfileIds: event.target.checked
                          ? [...draft.connectedProfileIds, staff.profileId!]
                          : draft.connectedProfileIds.filter((id: string) => id !== staff.profileId),
                      })}
                    />
                    <span>{staff.name}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {error && <p className="login-error">{error}</p>}
            <div className="user-security-actions">
              <Button variant="outline" disabled={busy} onClick={resetCode}>
                <KeyRound />
                Generate new access code
              </Button>
              <Button
                variant="outline"
                className="dialog-delete"
                disabled={busy || user.profileId === current.profileId}
                onClick={deactivate}
              >
                <Trash2 />
                Deactivate user
              </Button>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setUser(null)}>
            {newCode ? "Done" : "Cancel"}
          </Button>
          {!newCode && (
            <Button
              className="add-button"
              disabled={busy || !draft.name.trim()}
              onClick={save}
            >
              {busy ? (
                <>
                  <Loader2 className="spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function PropertiesView({
  tasks,
  maintenance,
  renewals,
  newLeases,
  manager,
  current,
  users,
}: any) {
  const assignees = getProfileAssignees(users, current),
    allowed = (name: string) => manager || assignees.includes(name),
    properties = new Map<
      string,
      {
        tasks: number;
        maintenance: number;
        renewals: number;
        leases: number;
        urgent: boolean;
      }
    >(),
    get = (name: string) => {
      const key = name.trim();
      if (!properties.has(key))
        properties.set(key, {
          tasks: 0,
          maintenance: 0,
          renewals: 0,
          leases: 0,
          urgent: false,
        });
      return properties.get(key)!;
    };
  tasks
    .filter(
      (t: Task) =>
        !t.archived &&
        t.property &&
        t.property !== "General office" &&
        allowed(t.assignee),
    )
    .forEach((t: Task) => {
      const p = get(t.property);
      p.tasks++;
      p.urgent = p.urgent || (!t.done && t.priority === "Urgent");
    });
  maintenance
    .filter(
      (m: Maintenance) => !m.archived && m.property && allowed(m.assigned),
    )
    .forEach((m: Maintenance) => {
      const p = get(m.property);
      p.maintenance++;
      p.urgent =
        p.urgent || (m.status !== "Completed" && m.priority === "Urgent");
    });
  renewals
    .filter((r: LeaseRenewal) => r.property && allowed(r.assigned))
    .forEach((r: LeaseRenewal) => {
      const p = get(r.property);
      p.renewals++;
      p.urgent =
        p.urgent || (!renewalComplete(r) && daysUntil(r.leaseEndDate) <= 31);
    });
  newLeases
    .filter((l: NewLease) => l.property && allowed(l.assigned))
    .forEach((l: NewLease) => {
      const p = get(l.property);
      p.leases++;
      p.urgent =
        p.urgent ||
        (!workflowComplete(newLeaseStages, l.stage) &&
          daysUntil(l.occupationDate) <= 14);
    });
  const rows = [...properties.entries()].sort(
    (a, b) =>
      Number(b[1].urgent) - Number(a[1].urgent) || a[0].localeCompare(b[0]),
  );
  return rows.length ? (
    <div className="property-grid">
      {rows.map(([name, counts]) => {
        const total =
            counts.tasks + counts.maintenance + counts.renewals + counts.leases,
          summary = [
            counts.tasks &&
              `${counts.tasks} task${counts.tasks === 1 ? "" : "s"}`,
            counts.maintenance && `${counts.maintenance} maintenance`,
            counts.renewals &&
              `${counts.renewals} renewal${counts.renewals === 1 ? "" : "s"}`,
            counts.leases &&
              `${counts.leases} new lease${counts.leases === 1 ? "" : "s"}`,
          ]
            .filter(Boolean)
            .join(" · ");
        return (
          <article key={name} className={counts.urgent ? "urgent" : ""}>
            <span className="property-icon">
              <Building2 />
            </span>
            <div>
              <h2>{name}</h2>
              <p>{summary}</p>
              <small>
                {counts.urgent ? "Needs urgent attention" : "Current activity"}
              </small>
            </div>
            <b>
              {total} item{total === 1 ? "" : "s"}
            </b>
          </article>
        );
      })}
    </div>
  ) : (
    <div className="empty-state property-empty">
      <Building2 />
      <h3>No properties yet</h3>
      <p>
        Properties will appear automatically when a real task, maintenance
        issue, renewal or new lease is added.
      </p>
    </div>
  );
}
function MaintenanceDialog({
  open,
  setOpen,
  form,
  setForm,
  addMaintenance,
  users,
}: any) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="task-dialog">
        <DialogHeader>
          <DialogTitle>Log a maintenance issue</DialogTitle>
          <DialogDescription>
            Add the issue, property, responsibility and urgency.
          </DialogDescription>
        </DialogHeader>
        <div className="form-grid maintenance-add-form">
          <label>
            Issue
            <input
              autoFocus
              value={form.issue}
              onChange={(e: any) => setForm({ ...form, issue: e.target.value })}
              placeholder="e.g. Leaking kitchen tap"
            />
          </label>
          <label>
            Property
            <input
              value={form.property}
              onChange={(e: any) =>
                setForm({ ...form, property: e.target.value })
              }
              placeholder="Property address or unit"
            />
          </label>
          <label>
            Assigned to
            <select
              value={form.assigned}
              onChange={(e: any) =>
                setForm({ ...form, assigned: e.target.value })
              }
            >
              {users.map((u: User) => (
                <option key={u.name} value={u.short}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Urgency
            <select
              value={form.priority}
              onChange={(e: any) =>
                setForm({ ...form, priority: e.target.value as Priority })
              }
            >
              <option value="Normal">Not urgent</option>
              <option value="Urgent">Urgent</option>
            </select>
          </label>
          <label className="feedback-field">
            Initial feedback
            <textarea
              value={form.feedback}
              onChange={(e: any) =>
                setForm({ ...form, feedback: e.target.value })
              }
              placeholder="Add any tenant, contractor or agent feedback..."
            />
          </label>
          <AccessPicker form={form} setForm={setForm} users={users} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="add-button" onClick={addMaintenance}>
            Add issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function MaintenanceView({
  items,
  setItems,
  manager,
  current,
  users,
  onAdd,
  onStatus,
}: any) {
  const [history, setHistory] = useState(false),
    assignees = getProfileAssignees(users, current),
    scopedAll = manager
      ? items
      : items.filter((m: Maintenance) => canAccessRecord(m, current, manager, assignees)),
    scoped = scopedAll
      .filter((m: Maintenance) => (history ? Boolean(m.archived) : !m.archived))
      .sort(
        (a: Maintenance, b: Maintenance) =>
          Number(b.priority === "Urgent") - Number(a.priority === "Urgent"),
      );
  const update = (
    item: Maintenance,
    field: keyof Maintenance,
    value: string,
  ) => {
    const now = new Date().toISOString();
    setItems((all: Maintenance[]) =>
      all.map((m) =>
        m.id === item.id
          ? {
              ...m,
              [field]: value,
              ...(field === "status"
                ? {
                    completedAt: value === "Completed" ? now : undefined,
                    archived: value === "Completed",
                    archivedAt: value === "Completed" ? now : undefined,
                  }
                : {}),
            }
          : m,
      ),
    );
    if (field === "status" && value !== item.status) onStatus?.(item, value);
  };
  const deleteIssue = (id: number) => {
    if (window.confirm("Delete this maintenance ticket?"))
      setItems((all: Maintenance[]) => all.filter((m) => m.id !== id));
  };
  return (
    <div className="maintenance-list">
      <div className="maintenance-toolbar">
        <div>
          <strong>{scoped.length}</strong>
          <span>{history ? "Completed issues" : "Open issues"}</span>
        </div>
        <div className="urgent-total">
          <strong>
            {
              scoped.filter(
                (m: Maintenance) =>
                  m.priority === "Urgent" && m.status !== "Completed",
              ).length
            }
          </strong>
          <span>Urgent</span>
        </div>
        <Button className="add-button" onClick={onAdd}>
          <Plus />
          Log maintenance
        </Button>
        <HistorySwitch history={history} setHistory={setHistory} />
      </div>
      {scoped.map((m: Maintenance) => (
        <article
          className={`maintenance-card ${m.priority.toLowerCase()} ${m.status === "Completed" ? "completed" : ""}`}
          key={m.id}
        >
          <div className="maintenance-head">
            <div>
              <span className="maintenance-date">
                LOGGED {m.date.toUpperCase()}
              </span>
              <h2>{m.issue}</h2>
              <p>
                <Building2 />
                {m.property}
              </p>
            </div>
            <div className="maintenance-head-actions">
              <span
                className={`maintenance-priority ${m.priority.toLowerCase()}`}
              >
                {m.priority === "Urgent" ? "Urgent" : "Not urgent"}
              </span>
              <button
                className="maintenance-complete"
                onClick={() =>
                  update(
                    m,
                    "status",
                    m.status === "Completed"
                      ? maintenanceStatuses[0]
                      : "Completed",
                  )
                }
              >
                {m.status === "Completed" ? "Reopen issue" : "Mark completed"}
              </button>
              <button
                className="maintenance-delete"
                onClick={() => deleteIssue(m.id)}
              >
                Delete ticket
              </button>
            </div>
          </div>
          <div className="maintenance-fields">
            <label>
              Assigned to
              <select
                value={m.assigned}
                onChange={(e) => update(m, "assigned", e.target.value)}
              >
                {(manager
                  ? users
                  : users.filter((u: User) => assignees.includes(u.short))
                ).map((u: User) => (
                  <option key={u.name} value={u.short}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Current status
              <select
                value={m.status}
                onChange={(e) => update(m, "status", e.target.value)}
              >
                {maintenanceStatuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="feedback-field">
              Feedback and updates
              <textarea
                value={m.feedback}
                onChange={(e) => update(m, "feedback", e.target.value)}
                placeholder="Add contractor, landlord, agent or tenant feedback here..."
              />
            </label>
          </div>
        </article>
      ))}
    </div>
  );
}
function NewLeaseDialog({ open, setOpen, form, setForm, add, users }: any) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="task-dialog compact-property-dialog">
        <DialogHeader>
          <DialogTitle>Add a new lease</DialogTitle>
          <DialogDescription>
            Create one property record and track it through FICA, compliance,
            signatures and WCU upload.
          </DialogDescription>
        </DialogHeader>
        <div className="form-grid">
          <label>
            Property
            <input
              autoFocus
              value={form.property}
              onChange={(e: any) =>
                setForm({ ...form, property: e.target.value })
              }
              placeholder="Property address or unit"
            />
          </label>
          <label>
            Occupation date
            <input
              type="date"
              value={form.occupationDate}
              onChange={(e: any) =>
                setForm({ ...form, occupationDate: e.target.value })
              }
            />
          </label>
          <label>
            Assigned to
            <select
              value={form.assigned}
              onChange={(e: any) =>
                setForm({ ...form, assigned: e.target.value })
              }
            >
              {users.map((u: User) => (
                <option key={u.name} value={u.short}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="notes-field">
            Initial notes
            <textarea
              value={form.notes}
              onChange={(e: any) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <AccessPicker form={form} setForm={setForm} users={users} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="add-button" onClick={add}>
            Create new lease
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function NewLeasesChecklistView({
  items,
  setItems,
  manager,
  current,
  users,
  onAdd,
  onUpdate,
}: any) {
  const [history, setHistory] = useState(false),
    assignees = getProfileAssignees(users, current),
    scoped = (
      manager
        ? items
        : items.filter((l: NewLease) => canAccessRecord(l, current, manager, assignees))
    )
      .filter((l: NewLease) => (history ? Boolean(l.archived) : !l.archived))
      .sort((a: NewLease, b: NewLease) =>
        a.occupationDate.localeCompare(b.occupationDate),
      );
  const update = (
    item: NewLease,
    changes: Partial<NewLease>,
    message: string,
  ) => {
    setItems((all: NewLease[]) =>
      all.map((l) => (l.id === item.id ? { ...l, ...changes } : l)),
    );
    onUpdate?.(item, message);
  };
  const toggleAction = (item: NewLease, action: string) => {
    const actions = newLeaseCompletedActions(item),
      checked = actions.includes(action),
      completedActions = checked
        ? actions.filter((value) => value !== action)
        : [...actions, action],
      allComplete = newLeaseStages.every((value) =>
        completedActions.includes(value),
      ),
      stage = allComplete
        ? `Completed: ${numberedStep(newLeaseStages, newLeaseStages.length - 1)}`
        : numberedStep(newLeaseStages, 0),
      now = new Date().toISOString();
    update(
      item,
      {
        completedActions,
        stage,
        archived: allComplete,
        archivedAt: allComplete ? now : undefined,
      },
      `${action} ${checked ? "reopened" : "completed"}`,
    );
  };
  const follow = (item: NewLease) =>
    update(
      item,
      {
        lastFollowUpAt: new Date().toISOString(),
        nextFollowUpDate: addBusinessDays(dateKey(0), 2),
      },
      "follow-up completed",
    );
  return (
    <div className="renewals-list">
      <div className="renewals-toolbar">
        <div>
          <strong>
            {scoped.filter((l: NewLease) => !newLeaseComplete(l)).length}
          </strong>
          <span>{history ? "Completed new leases" : "Active new leases"}</span>
        </div>
        <div className="renewal-due-total">
          <strong>
            {
              scoped.filter(
                (l: NewLease) =>
                  !newLeaseComplete(l) && daysUntil(l.occupationDate) <= 14,
              ).length
            }
          </strong>
          <span>Very urgent</span>
        </div>
        <Button className="add-button" onClick={onAdd}>
          <Plus />
          Add new lease
        </Button>
        <HistorySwitch history={history} setHistory={setHistory} />
      </div>
      {scoped.map((l: NewLease) => {
        const completedActions = newLeaseCompletedActions(l),
          completedCount = newLeaseStages.filter((action) =>
            completedActions.includes(action),
          ).length,
          completed = completedCount === newLeaseStages.length,
          urgent = !completed && daysUntil(l.occupationDate) <= 14;
        return (
          <article
            className={`renewal-card ${urgent ? "followup-due" : ""} ${completed ? "completed" : ""}`}
            key={l.id}
          >
            <div className="renewal-head">
              <div>
                <span className="renewal-label">NEW LEASE</span>
                <h2>{l.property}</h2>
                <p>
                  Occupation <b>{formatDate(l.occupationDate)}</b>
                </p>
              </div>
              <div className="renewal-head-actions">
                {urgent && (
                  <span className="followup-badge">
                    VERY URGENT · FINALISE ASAP
                  </span>
                )}
                <button
                  className="maintenance-delete"
                  onClick={() =>
                    window.confirm("Delete this new lease record?") &&
                    setItems((all: NewLease[]) =>
                      all.filter((x) => x.id !== l.id),
                    )
                  }
                >
                  Delete record
                </button>
              </div>
            </div>
            <section className="renewal-action-checklist">
              <div className="renewal-checklist-heading">
                <div>
                  <span>NEW LEASE CHECKLIST</span>
                  <strong>
                    {completedCount} of {newLeaseStages.length} completed
                  </strong>
                </div>
                <div className="step-progress">
                  <i
                    style={{
                      width: `${(completedCount / newLeaseStages.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="renewal-check-grid">
                {newLeaseStages.map((action) => (
                  <label
                    className={
                      completedActions.includes(action) ? "checked" : ""
                    }
                    key={action}
                  >
                    <Checkbox
                      checked={completedActions.includes(action)}
                      onCheckedChange={() => toggleAction(l, action)}
                    />
                    <span>{action}</span>
                  </label>
                ))}
              </div>
            </section>
            <div className="renewal-fields">
              <label>
                Assigned to
                <select
                  value={l.assigned}
                  onChange={(e) =>
                    update(
                      l,
                      { assigned: e.target.value },
                      `assigned to ${e.target.value}`,
                    )
                  }
                >
                  {(manager
                    ? users
                    : users.filter((u: User) => assignees.includes(u.short))
                  ).map((u: User) => (
                    <option key={u.name} value={u.short}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="standalone-notes">
              Notes and progress
              <textarea
                value={l.notes}
                onChange={(e) =>
                  update(l, { notes: e.target.value }, "notes updated")
                }
              />
            </label>
            <div className="renewal-followup">
              <div>
                <span>Next follow-up</span>
                <strong>{formatDate(l.nextFollowUpDate)}</strong>
              </div>
              {!completed && (
                <Button variant="outline" onClick={() => follow(l)}>
                  <Check />
                  Follow-up done today
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
function xmlSafe(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function downloadBackup(data: Record<string, any[]>) {
  const sheets = Object.entries(data)
    .map(([name, rows]) => {
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      return `<Worksheet ss:Name="${xmlSafe(name.slice(0, 31))}"><Table><Row>${cols.map((c) => `<Cell><Data ss:Type="String">${xmlSafe(c)}</Data></Cell>`).join("")}</Row>${rows.map((r) => `<Row>${cols.map((c) => `<Cell><Data ss:Type="String">${xmlSafe(typeof r[c] === "object" ? JSON.stringify(r[c]) : r[c])}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet>`;
    })
    .join("");
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets}</Workbook>`,
    url = URL.createObjectURL(
      new Blob([xml], { type: "application/vnd.ms-excel" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = `Pam-Golding-backup-${dateKey(0)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
function sendReport(email: string, subject: string, lines: string[]) {
  if (!email.trim()) {
    window.alert("Add the recipient email address first.");
    return;
  }
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}
function encodeApplicationDetails(values: string[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(values));
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function decodeApplicationDetails(value: string) {
  const padded =
      value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4),
    binary = atob(padded),
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as string[];
}
function ApplicationLinkControl({ user }: any) {
  const [email, setEmail] = useState(user.email || ""),
    [property, setProperty] = useState(""),
    [copied, setCopied] = useState(false);
  const share = async () => {
    if (!email.trim() || !property.trim()) {
      window.alert("Add the receiving agent email and property first.");
      return;
    }
    const details = encodeApplicationDetails([
        email.trim(),
        user.name,
        property.trim(),
      ]),
      url = `${window.location.origin}/?apply=${details}`,
      text = `Thank you for your interest in renting ${property.trim()} through Pam Golding Properties.\n\nComplete your application here:\n${url}`;
    if (navigator.share)
      await navigator.share({ title: "Pam Golding tenant application", text });
    else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  };
  return (
    <article>
      <strong>{user.name}</strong>
      <span>{user.role}</span>
      <label>
        Receiving email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="agent@pamgolding.co.za"
        />
      </label>
      <label>
        Property
        <input
          value={property}
          onChange={(e) => setProperty(e.target.value)}
          placeholder="Property address or unit"
        />
      </label>
      <Button variant="outline" onClick={share}>
        {copied ? "Link copied" : "Share application link"}
      </Button>
    </article>
  );
}
function SettingsView({
  tasks,
  maintenance,
  appointments,
  renewals,
  newLeases,
  users,
  current,
  manager,
  calendarControls,
}: any) {
  return (
    <div className="settings-grid">
      <section>
        <CalendarDays />
        <h2>Google Calendar</h2>
        <p>Your calendar syncs automatically every five minutes.</p>
        <CalendarConnection controls={calendarControls} />
      </section>
      <section>
        <Settings />
        <h2>Install on your phone</h2>
        <h3>Android</h3>
        <p>
          Open the app in Chrome, tap the three-dot menu, then{" "}
          <b>Add to Home screen</b> or <b>Install app</b>.
        </p>
        <h3>iPhone</h3>
        <p>
          Open the app in Safari, tap Share, then <b>Add to Home Screen</b>.
        </p>
        <small>
          When you use a camera field, allow camera access when Android or
          iPhone asks.
        </small>
      </section>
      <section>
        <FileText />
        <h2>Backup all information</h2>
        <p>
          Downloads one Excel-compatible workbook containing users, tasks,
          appointments, maintenance, renewals and new leases.
        </p>
        <Button
          className="add-button"
          onClick={() =>
            downloadBackup({
              Users: users,
              Tasks: tasks,
              Appointments: appointments,
              Maintenance: maintenance,
              Renewals: renewals,
              "New Leases": newLeases,
            })
          }
        >
          Download Excel backup
        </Button>
      </section>
      <section className="application-links-settings">
        <FileText />
        <h2>Tenant application links</h2>
        <p>
          Create a property-specific link for a prospective tenant. They choose
          Individual or Juristic Entity, complete every field and upload all
          required documents.
        </p>
        <div className="application-profile-links">
          {(manager
            ? users
            : users.filter((u: User) =>
                getProfileAssignees(users, current).includes(u.short),
              )
          ).map((u: User) => (
            <ApplicationLinkControl key={u.name} user={u} />
          ))}
        </div>
      </section>
    </div>
  );
}
function ReportsView({
  tasks,
  maintenance,
  renewals,
  newLeases,
  settings,
  setSettings,
}: any) {
  const done = tasks.filter((t: Task) => t.done).length,
    maintenanceLines = maintenance.map(
      (m: Maintenance) =>
        `${m.property} | ${m.issue} | ${m.status} | ${m.assigned}`,
    ),
    renewalLines = renewals.map(
      (r: LeaseRenewal) =>
        `${r.property} | expires ${r.leaseEndDate} | ${r.stage} | ${r.assigned}`,
    ),
    newLeaseLines = newLeases.map(
      (l: NewLease) =>
        `${l.property} | occupation ${l.occupationDate} | ${l.stage} | ${l.assigned}`,
    );
  return (
    <>
      <div className="report-grid">
        <article>
          <p>Task completion</p>
          <strong>
            {tasks.length ? Math.round((done / tasks.length) * 100) : 0}%
          </strong>
          <div className="report-bar">
            <i
              style={{
                width: `${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%`,
              }}
            />
          </div>
          <small>
            {done} of {tasks.length} completed
          </small>
        </article>
        <article>
          <p>Current workload</p>
          <strong>{tasks.filter((t: Task) => !t.done).length}</strong>
          <small>Open tasks across the staff</small>
        </article>
        <article>
          <p>Overdue</p>
          <strong className="red-number">
            {
              tasks.filter(
                (t: Task) => taskDueState(t.due) === "Overdue" && !t.done,
              ).length
            }
          </strong>
          <small>Needs manager attention</small>
        </article>
      </div>
      <div className="weekly-report-grid">
        <section className="report-settings">
          <Wrench />
          <h2>Weekly maintenance email</h2>
          <label>
            Recipient email
            <input
              type="email"
              value={settings.maintenanceEmail || ""}
              onChange={(e) =>
                setSettings({ ...settings, maintenanceEmail: e.target.value })
              }
            />
          </label>
          <Button
            variant="outline"
            onClick={() =>
              sendReport(
                settings.maintenanceEmail,
                "Weekly maintenance report",
                ["WEEKLY MAINTENANCE REPORT", "", ...maintenanceLines],
              )
            }
          >
            Prepare maintenance email
          </Button>
        </section>
        <section className="report-settings">
          <FileText />
          <h2>Weekly renewals email</h2>
          <label>
            Recipient email
            <input
              type="email"
              value={settings.renewalsEmail || ""}
              onChange={(e) =>
                setSettings({ ...settings, renewalsEmail: e.target.value })
              }
            />
          </label>
          <Button
            variant="outline"
            onClick={() =>
              sendReport(
                settings.renewalsEmail,
                "Weekly lease renewals report",
                ["WEEKLY LEASE RENEWALS REPORT", "", ...renewalLines],
              )
            }
          >
            Prepare renewals email
          </Button>
        </section>
        <section className="report-settings">
          <Building2 />
          <h2>Weekly new leases email</h2>
          <label>
            Recipient email
            <input
              type="email"
              value={settings.newLeasesEmail || ""}
              onChange={(e) =>
                setSettings({ ...settings, newLeasesEmail: e.target.value })
              }
            />
          </label>
          <Button
            variant="outline"
            onClick={() =>
              sendReport(settings.newLeasesEmail, "Weekly new leases report", [
                "WEEKLY NEW LEASES REPORT",
                "",
                ...newLeaseLines,
              ])
            }
          >
            Prepare new leases email
          </Button>
          <small>
            This device-only version prepares each report for review and
            sending.
          </small>
        </section>
      </div>
    </>
  );
}
