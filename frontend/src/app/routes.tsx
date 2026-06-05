import { createBrowserRouter } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { RequesterDashboard } from "./pages/RequesterDashboard";
import { BookingRequestForm } from "./pages/BookingRequestForm";
import { VenueAvailability } from "./pages/VenueAvailability";
import { ApproverDashboard } from "./pages/ApproverDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AuditLogPage } from "./pages/AuditLogPage";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "../components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LoginPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/requester",
    element: <ProtectedRoute allowedRoles={["REQUESTER"]} />,
    children: [
      {
        element: <Layout role="requester" />,
        children: [
      {
        index: true,
        element: <RequesterDashboard />,
      },
      {
        path: "new-request",
        element: <BookingRequestForm />,
      },
      {
        path: "availability",
        element: <VenueAvailability />,
      },
        ],
      },
    ],
  },
  {
    path: "/approver",
    element: <ProtectedRoute allowedRoles={["PARISH_SECRETARY", "PARISH_PRIEST"]} />,
    children: [
      {
        element: <Layout role="approver" />,
        children: [
      {
        index: true,
        element: <ApproverDashboard />,
      },
      {
        path: "availability",
        element: <VenueAvailability />,
      },
        ],
      },
    ],
  },
  {
    path: "/admin",
    element: <ProtectedRoute allowedRoles={["PARISH_PRIEST", "ADMIN"]} />,
    children: [
      {
        element: <Layout role="admin" />,
        children: [
      {
        index: true,
        element: <AdminDashboard />,
      },
      {
        path: "audit-log",
        element: <AuditLogPage />,
      },
      {
        path: "availability",
        element: <VenueAvailability />,
      },
        ],
      },
    ],
  },
]);
