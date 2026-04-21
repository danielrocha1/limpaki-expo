import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "antd/dist/reset.css";
import "./index.css";
import App from "./App";
import Login from "./forms/login";
import MultiStepForm from "./forms";
import Header from "./header";
import BottomNavigation from "./header/BottomNavigation";
import { AddressProvider, useAddress } from "./context/address";
import { ReviewProvider } from "./context/service";
import { ChatCenterProvider } from "./context/chatCenter";
import { OnlinePresenceProvider } from "./context/onlinePresence";
import GlobalChatDrawer from "./services/chat/GlobalChatDrawer";
import ChatFloatingButton from "./services/chat/ChatFloatingButton";
import ChatRealtimeWarmup from "./services/chat/ChatRealtimeWarmup";
import EmailVerificationBanner from "./components/EmailVerificationBanner";

const AddressForm = lazy(() => import("./forms/addressform"));
const DocumentItem = lazy(() => import("./uploadDocumentos"));
const ProfilePage = lazy(() => import("./profile"));
const MapPage = lazy(() => import("./diaristmap"));
const ServicesPage = lazy(() => import("./services"));
const OffersBoard = lazy(() => import("./offers"));
const VerifyEmailPage = lazy(() => import("./auth/VerifyEmailPage"));
const ResetPasswordPage = lazy(() => import("./auth/ResetPasswordPage"));
const SubscriptionPlansPage = lazy(() =>
  import("./subscription/SubscriptionPages").then((module) => ({
    default: module.SubscriptionPlansPage,
  }))
);
const SubscriptionSuccessPage = lazy(() =>
  import("./subscription/SubscriptionPages").then((module) => ({
    default: module.SubscriptionSuccessPage,
  }))
);
const SubscriptionDeniedPage = lazy(() =>
  import("./subscription/SubscriptionPages").then((module) => ({
    default: module.SubscriptionDeniedPage,
  }))
);

const RouteLoadingFallback = () => (
  <div className="route-loading-fallback" role="status" aria-live="polite">
    <div className="route-loading-fallback__spinner" aria-hidden="true" />
    <span>Carregando...</span>
  </div>
);

const PrivateRoute = ({ element, redirectTo = "/login" }) => {
  const { Logged, sessionLoading } = useAddress();

  if (sessionLoading) {
    return <RouteLoadingFallback />;
  }

  return Logged ? element : <Navigate to={redirectTo} replace />;
};

const PublicOnlyRoute = ({ element, redirectTo = "/services" }) => {
  const { Logged, hasValidSubscription, isTestUser, sessionLoading } = useAddress();

  if (!Logged) {
    return element;
  }

  if (sessionLoading) {
    return <RouteLoadingFallback />;
  }

  return <Navigate to={hasValidSubscription || isTestUser ? redirectTo : "/assinatura/planos"} replace />;
};

const ClientOnlyRoute = ({ element }) => {
  const { Logged, sessionLoading, userRole } = useAddress();

  if (!Logged) {
    return <Navigate to="/login" replace />;
  }

  if (sessionLoading) {
    return <RouteLoadingFallback />;
  }

  return userRole === "diarista" ? <Navigate to="/offers" replace /> : element;
};

const SubscriptionRoute = ({ element }) => {
  const { Logged, sessionLoading, hasValidSubscription, isTestUser } = useAddress();

  if (!Logged) {
    return <Navigate to="/login" replace />;
  }

  if (sessionLoading) {
    return <RouteLoadingFallback />;
  }

  return hasValidSubscription || isTestUser ? element : <Navigate to="/assinatura/planos" replace />;
};

const subscriptionExemptPaths = new Set([
  "/",
  "/login",
  "/register",
  "/assinatura/planos",
  "/assinatura/success",
  "/assinatura/sucess",
  "/assinatura/denied",
]);

const SubscriptionGate = ({ children }) => {
  const location = useLocation();
  const { Logged, sessionLoading, hasValidSubscription, isTestUser } = useAddress();

  if (!Logged || subscriptionExemptPaths.has(location.pathname)) {
    return children;
  }

  if (sessionLoading) {
    return <RouteLoadingFallback />;
  }

  if (!hasValidSubscription && !isTestUser) {
    return <Navigate to="/assinatura/planos" replace state={{ from: location.pathname }} />;
  }

  return children;
};

const AppRoutes = React.memo(() => (
  <Suspense fallback={<RouteLoadingFallback />}>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/login" element={<PublicOnlyRoute element={<Login />} />} />
      <Route path="/register" element={<PublicOnlyRoute element={<MultiStepForm />} />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/assinatura/planos" element={<PrivateRoute element={<SubscriptionPlansPage />} />} />
      <Route path="/assinatura/success" element={<SubscriptionSuccessPage />} />
      <Route path="/assinatura/sucess" element={<SubscriptionSuccessPage />} />
      <Route path="/assinatura/denied" element={<SubscriptionDeniedPage />} />
      <Route path="/services" element={<SubscriptionRoute element={<ServicesPage />} />} />
      <Route path="/offers" element={<SubscriptionRoute element={<OffersBoard />} />} />
      <Route path="/profile" element={<PrivateRoute element={<ProfilePage />} />} />
      <Route path="/addressform" element={<PrivateRoute element={<AddressForm />} />} />
      <Route path="/upload" element={<PrivateRoute element={<DocumentItem />} />} />
      <Route path="/map" element={<SubscriptionRoute element={<ClientOnlyRoute element={<MapPage />} />} />} />
    </Routes>
  </Suspense>
));

const AppShell = () => (
  <div className="app-shell">
    <Header />
    <SubscriptionGate>
      <EmailVerificationBanner />
      <main className="app-shell-main">
        <AppRoutes />
      </main>
    </SubscriptionGate>
    <BottomNavigation />
    <GlobalChatDrawer />
    <ChatFloatingButton />
    <ChatRealtimeWarmup />
  </div>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Router>
      <AddressProvider>
        <ReviewProvider>
          <OnlinePresenceProvider>
            <ChatCenterProvider>
              <AppShell />
            </ChatCenterProvider>
          </OnlinePresenceProvider>
        </ReviewProvider>
      </AddressProvider>
    </Router>
  </React.StrictMode>
);
