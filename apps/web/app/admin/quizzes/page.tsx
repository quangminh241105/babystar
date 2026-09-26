"use client";

import { useEffect, useState } from "react";
import AppShell from "../../../components/AppShell";
import Loading from "../../../components/Loading";
import RequireUser from "../../../components/RequireUser";
import PageHeader from "../../../components/PageHeader";
import { apiFetch } from "../../../lib/api";

export default function AdminQuizPage() { return <AppShell><RequireUser admin><AdminQuizzes /></RequireUser></AppShell>; }
function AdminQuizzes() { const [items, setItems] = useState<any[] | null>(null); useEffect(() => { apiFetch<{ quizzes: any[] }>("/admin/quizzes").then((body) => setItems(body.quizzes)); }, []); if (!items) return <Loading />; return <><PageHeader eyebrow="Content" title="Quiz library" description="Review the learning content available to members." /><div className="card">{items.length === 0 ? <p className="muted">No quizzes have been created yet.</p> : <div className="list">{items.map((quiz) => <div className="list-item" key={quiz.id}><div><strong>{quiz.title}</strong><div className="muted">{quiz.category} · {quiz.question_count} questions</div></div><span className="pill">{quiz.is_active ? "Published" : "Hidden"}</span></div>)}</div>}</div></>; }

