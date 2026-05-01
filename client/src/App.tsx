import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import FleetOwnerLayout from "./components/FleetOwnerLayout";

// Public Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Track from "./pages/Track";
import RequestDelivery from "./pages/RequestDelivery";
import Services from "./pages/Services";
import About from "./pages/About";
import Contact from "./pages/Contact";
import { Terms, Privacy } from "./pages/Legal";
import NotFound from "./pages/NotFound";
import Wallet from "./pages/Wallet";
import Referral from "./pages/Referral";
import Profile from "./pages/Profile";
import GetStarted from "./pages/GetStarted";
import ChooseAccountType from "./pages/ChooseAccountType";
import FleetOwnerOnboarding from "./pages/FleetOwnerOnboarding";
import FleetOwnerStatus from "./pages/FleetOwnerStatus";
import FleetOwnerDashboard from "./pages/FleetOwnerDashboard";
import FleetOwnerFleet from "./pages/FleetOwnerFleet";
import FleetOwnerEarnings from "./pages/FleetOwnerEarnings";
import FleetOwnerPayouts from "./pages/FleetOwnerPayouts";
import RiderPortal from "./pages/RiderPortal";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminOrders from "./pages/admin/Orders";
import OrderDetail from "./pages/admin/OrderDetail";
import NewOrder from "./pages/admin/NewOrder";
import AdminRiders from "./pages/admin/Riders";
import AdminDevices from "./pages/admin/Devices";
import AdminWallets from "./pages/admin/Wallets";
import WalletDetail from "./pages/admin/WalletDetail";
import AdminPartners from "./pages/admin/Partners";
import PartnerDetail from "./pages/admin/PartnerDetail";
import NewPartner from "./pages/admin/NewPartner";
import TestingTools from "./pages/admin/TestingTools";
import AdminUsers from "./pages/admin/Users";
import UserDetail from "./pages/admin/UserDetail";
import CancelledEarnings from "./pages/admin/CancelledEarnings";
import SettlementWarnings from "./pages/admin/SettlementWarnings";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Switch>
            {/* Admin routes - full paths */}
            <Route path="/admin/orders/new">
              <AdminLayout>
                <NewOrder />
              </AdminLayout>
            </Route>
            <Route path="/admin/orders/:id">
              {(params) => (
                <AdminLayout>
                  <OrderDetail />
                </AdminLayout>
              )}
            </Route>
            <Route path="/admin/orders">
              <AdminLayout>
                <AdminOrders />
              </AdminLayout>
            </Route>
            <Route path="/admin/riders">
              <AdminLayout>
                <AdminRiders />
              </AdminLayout>
            </Route>
            <Route path="/admin/devices">
              <AdminLayout>
                <AdminDevices />
              </AdminLayout>
            </Route>
            <Route path="/admin/wallets/:userId">
              {(params) => (
                <AdminLayout>
                  <WalletDetail />
                </AdminLayout>
              )}
            </Route>
            <Route path="/admin/wallets">
              <AdminLayout>
                <AdminWallets />
              </AdminLayout>
            </Route>
            <Route path="/admin/partners/new">
              <AdminLayout>
                <NewPartner />
              </AdminLayout>
            </Route>
            <Route path="/admin/partners/:id">
              {(params) => (
                <AdminLayout>
                  <PartnerDetail />
                </AdminLayout>
              )}
            </Route>
            <Route path="/admin/partners">
              <AdminLayout>
                <AdminPartners />
              </AdminLayout>
            </Route>
            <Route path="/admin/users/:id">
              {(params) => (
                <AdminLayout>
                  <UserDetail />
                </AdminLayout>
              )}
            </Route>
            <Route path="/admin/users">
              <AdminLayout>
                <AdminUsers />
              </AdminLayout>
            </Route>
            <Route path="/admin/cancelled-earnings">
              <AdminLayout>
                <CancelledEarnings />
              </AdminLayout>
            </Route>
            <Route path="/admin/settlement-warnings">
              <AdminLayout>
                <SettlementWarnings />
              </AdminLayout>
            </Route>
            <Route path="/admin/testing">
              <AdminLayout>
                <TestingTools />
              </AdminLayout>
            </Route>
            <Route path="/admin">
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </Route>
            {/* Rider Portal */}
            <Route path="/rider">
              <RiderPortal />
            </Route>
            {/* Fleet Owner routes */}
            <Route path="/fleet-owner/dashboard">
              <FleetOwnerLayout>
                <FleetOwnerDashboard />
              </FleetOwnerLayout>
            </Route>
            <Route path="/fleet-owner/fleet">
              <FleetOwnerLayout>
                <FleetOwnerFleet />
              </FleetOwnerLayout>
            </Route>
            <Route path="/fleet-owner/earnings">
              <FleetOwnerLayout>
                <FleetOwnerEarnings />
              </FleetOwnerLayout>
            </Route>
            <Route path="/fleet-owner/payouts">
              <FleetOwnerLayout>
                <FleetOwnerPayouts />
              </FleetOwnerLayout>
            </Route>
            <Route path="/fleet-owner/status">
              <Layout>
                <FleetOwnerStatus />
              </Layout>
            </Route>
            <Route path="/fleet-owner/onboarding">
              <Layout>
                <FleetOwnerOnboarding />
              </Layout>
            </Route>
            <Route path="/choose-account-type">
              <Layout>
                <ChooseAccountType />
              </Layout>
            </Route>
            <Route path="/get-started">
              <GetStarted />
            </Route>
            <Route path="/login">
              <Login />
            </Route>
            {/* Public routes */}
            <Route path="/">
              <Layout>
                <Home />
              </Layout>
            </Route>
            <Route path="/track/:id">
              {(params) => (
                <Layout>
                  <Track />
                </Layout>
              )}
            </Route>
            <Route path="/track">
              <Layout>
                <Track />
              </Layout>
            </Route>
            <Route path="/request-delivery">
              <Layout>
                <RequestDelivery />
              </Layout>
            </Route>
            <Route path="/services">
              <Layout>
                <Services />
              </Layout>
            </Route>
            <Route path="/about">
              <Layout>
                <About />
              </Layout>
            </Route>
            <Route path="/contact">
              <Layout>
                <Contact />
              </Layout>
            </Route>
            <Route path="/terms">
              <Layout>
                <Terms />
              </Layout>
            </Route>
            <Route path="/privacy">
              <Layout>
                <Privacy />
              </Layout>
            </Route>
            <Route path="/wallet">
              <Layout>
                <Wallet />
              </Layout>
            </Route>
            <Route path="/referral">
              <Layout>
                <Referral />
              </Layout>
            </Route>
            <Route path="/profile">
              <Layout>
                <Profile />
              </Layout>
            </Route>
            <Route>
              <Layout>
                <NotFound />
              </Layout>
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
