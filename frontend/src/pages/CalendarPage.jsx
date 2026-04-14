import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import { Calendar, momentLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { useSearchParams } from "react-router-dom";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { createTask, deleteTask, getTasks, updateTask } from "../services/api";

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

const PLAN_COLORS = [
  { background: "#0f766e", border: "#115e59" },
  { background: "#1d4ed8", border: "#1e40af" },
  { background: "#7c3aed", border: "#6d28d9" },
  { background: "#be123c", border: "#9f1239" },
  { background: "#b45309", border: "#92400e" },
  { background: "#166534", border: "#14532d" }
];

function toInputDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60 * 1000);
  return normalized.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getPlanLabel(planId) {
  return planId || "Unassigned";
}

function buildPlanColorMap(tasks) {
  const uniquePlanIds = Array.from(new Set(tasks.map((task) => task.planId || "")));

  return uniquePlanIds.reduce((accumulator, planId, index) => {
    accumulator[planId] = PLAN_COLORS[index % PLAN_COLORS.length];
    return accumulator;
  }, {});
}

function CalendarPage() {
  const [searchParams] = useSearchParams();
  const selectedPlanId = searchParams.get("planId") || "";
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [hiddenPlans, setHiddenPlans] = useState({});
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    planId: ""
  });

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getTasks();
      setTasks(Array.isArray(response.tasks) ? response.tasks : []);
    } catch (loadError) {
      const message = axios.isAxiosError(loadError) ? loadError.message : loadError.message || "Failed to load tasks";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const planColorMap = useMemo(() => buildPlanColorMap(tasks), [tasks]);

  const plans = useMemo(
    () =>
      Array.from(new Set(tasks.map((task) => task.planId || ""))).map((planId) => ({
        id: planId,
        label: getPlanLabel(planId),
        color: planColorMap[planId] || PLAN_COLORS[0]
      })),
    [planColorMap, tasks]
  );

  const events = useMemo(
    () =>
      tasks
        .filter((task) => !hiddenPlans[task.planId || ""])
        .map((task) => ({
          id: task.id,
          title: task.title,
          start: new Date(task.startTime),
          end: new Date(task.endTime),
          resource: task
        })),
    [hiddenPlans, tasks]
  );

  const eventPropGetter = useCallback(
    (event) => {
      const colorSet = planColorMap[event.resource?.planId || ""] || PLAN_COLORS[0];

      return {
        style: {
          backgroundColor: colorSet.background,
          borderColor: colorSet.border,
          borderRadius: "12px",
          color: "#ffffff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)"
        }
      };
    },
    [planColorMap]
  );

  const closeCreateModal = () => {
    setSelectedSlot(null);
    setCreateForm({
      title: "",
      description: "",
      startTime: "",
      endTime: "",
      planId: ""
    });
  };

  const handleSelectSlot = ({ start, end }) => {
    setSelectedEvent(null);
    setSelectedSlot({ start, end });
    setCreateForm({
      title: "",
      description: "",
      startTime: toInputDateTime(start),
      endTime: toInputDateTime(end),
      planId: ""
    });
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await createTask({
        title: createForm.title,
        description: createForm.description,
        startTime: new Date(createForm.startTime).toISOString(),
        endTime: new Date(createForm.endTime).toISOString(),
        planId: createForm.planId
      });
      closeCreateModal();
      await loadTasks();
    } catch (saveError) {
      const message = axios.isAxiosError(saveError) ? saveError.message : saveError.message || "Failed to create task";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectEvent = (event) => {
    setSelectedSlot(null);
    setSelectedEvent(event.resource);
  };

  const handleDeleteTask = async () => {
    if (!selectedEvent) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await deleteTask(selectedEvent.id);
      setSelectedEvent(null);
      await loadTasks();
    } catch (deleteError) {
      const message = axios.isAxiosError(deleteError) ? deleteError.message : deleteError.message || "Failed to delete task";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleEventDrop = async ({ event, start, end }) => {
    setError("");

    try {
      await updateTask(event.resource.id, {
        title: event.resource.title,
        description: event.resource.description,
        planId: event.resource.planId,
        completed: event.resource.completed,
        startTime: start.toISOString(),
        endTime: end.toISOString()
      });
      await loadTasks();
    } catch (dropError) {
      const message = axios.isAxiosError(dropError) ? dropError.message : dropError.message || "Failed to move task";
      setError(message);
    }
  };

  const handleEventResize = async ({ event, start, end }) => {
    await handleEventDrop({ event, start, end });
  };

  const togglePlanVisibility = (planId) => {
    setHiddenPlans((current) => ({
      ...current,
      [planId]: !current[planId]
    }));
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#dbeafe_100%)] px-4 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row">
        <aside className="w-full rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/70 lg:max-w-xs">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Study Calendar</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Plan your study sessions visually.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Create tasks by selecting a time slot, drag sessions to reschedule them, and keep your Google Calendar sync in step with your plan.
          </p>

          <div className="mt-8 rounded-3xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Study Plans</p>
            <div className="mt-4 space-y-3">
              {plans.length ? (
                plans.map((plan) => (
                  <label
                    key={plan.id || "unassigned"}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 ${
                      selectedPlanId && plan.id === selectedPlanId
                        ? "border-2 border-sky-500 bg-sky-50"
                        : "border border-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: plan.color.background }}
                      />
                      {plan.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={!hiddenPlans[plan.id]}
                      onChange={() => togglePlanVisibility(plan.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                  </label>
                ))
              ) : (
                <p className="text-sm text-slate-500">Your study tasks will appear here once you create them.</p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-slate-950 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Quick Guide</p>
            <p className="mt-3 text-sm leading-6 text-slate-200">Click or drag over a slot to create a task. Click an event to inspect or delete it. Drag an event to update its schedule.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 rounded-[2rem] border border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-200/70">
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 px-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Calendar</h2>
              <p className="mt-1 text-sm text-slate-500">Tasks are loaded from `GET /api/tasks` using your saved JWT token.</p>
            </div>
            <button
              type="button"
              onClick={loadTasks}
              disabled={loading}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          {loading ? (
            <div className="flex h-[70vh] items-center justify-center rounded-[1.5rem] bg-slate-50 text-sm font-medium text-slate-500">
              Loading your study tasks...
            </div>
          ) : (
            <div className="calendar-shell overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-2">
              <DnDCalendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: "90vh" }}
                selectable={true}
                resizable
                popup
                views={["month", "week", "day", "agenda"]}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                onEventDrop={handleEventDrop}
                onEventResize={handleEventResize}
                eventPropGetter={eventPropGetter}
              />
            </div>
          )}
        </section>
      </div>

      {selectedSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Create Task</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Add a study session</h3>
              </div>
              <button type="button" onClick={closeCreateModal} className="text-sm font-medium text-slate-500">
                Close
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCreateTask}>
              <input
                type="text"
                placeholder="Task title"
                value={createForm.title}
                onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                required
              />
              <textarea
                placeholder="Description"
                value={createForm.description}
                onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
              <input
                type="text"
                placeholder="Plan ID"
                value={createForm.planId}
                onChange={(event) => setCreateForm((current) => ({ ...current, planId: event.target.value }))}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-600">
                  <span className="mb-2 block font-medium">Start time</span>
                  <input
                    type="datetime-local"
                    value={createForm.startTime}
                    onChange={(event) => setCreateForm((current) => ({ ...current, startTime: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    required
                  />
                </label>
                <label className="text-sm text-slate-600">
                  <span className="mb-2 block font-medium">End time</span>
                  <input
                    type="datetime-local"
                    value={createForm.endTime}
                    onChange={(event) => setCreateForm((current) => ({ ...current, endTime: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    required
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Task Details</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedEvent.title}</h3>
              </div>
              <button type="button" onClick={() => setSelectedEvent(null)} className="text-sm font-medium text-slate-500">
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4 rounded-3xl bg-slate-50 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Description</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{selectedEvent.description || "No description provided."}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start</p>
                  <p className="mt-2 text-sm text-slate-700">{formatDateTime(selectedEvent.startTime)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">End</p>
                  <p className="mt-2 text-sm text-slate-700">{formatDateTime(selectedEvent.endTime)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Study Plan</p>
                <p className="mt-2 text-sm text-slate-700">{getPlanLabel(selectedEvent.planId)}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={saving}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Deleting..." : "Delete Task"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CalendarPage;
