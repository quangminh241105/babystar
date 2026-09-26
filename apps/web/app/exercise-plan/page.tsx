import AppShell from "../../components/AppShell";
import PlanClient from "../../components/PlanClient";
import RequireUser from "../../components/RequireUser";

export default function ExercisePlanPage() { return <AppShell><RequireUser><PlanClient kind="exercise" /></RequireUser></AppShell>; }

