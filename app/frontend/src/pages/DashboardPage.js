import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Cube, SignOut, Flask, ChartLine, CurrencyDollar, Leaf, ShieldCheck } from '@phosphor-icons/react';
import { StrengthPrediction } from '../components/dashboard/StrengthPrediction';
import { MixOptimization } from '../components/dashboard/MixOptimization';
import { CostCalculator } from '../components/dashboard/CostCalculator';
import { CarbonCalculator } from '../components/dashboard/CarbonCalculator';

export const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('predict');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cube size={32} weight="bold" className="text-primary" />
              <div>
                <h1 className="font-heading text-2xl font-black tracking-tight">ConcreteMix AI</h1>
                <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-bold">Engineering Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user?.role === 'admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="border-orange-300 text-orange-600 hover:bg-orange-50"
                >
                  <ShieldCheck size={16} className="mr-2" />
                  Admin Panel
                </Button>
              )}
              <div className="text-right">
                <p className="text-sm font-medium" data-testid="user-name">{user?.name}</p>
                <p className="text-xs text-muted-foreground" data-testid="user-email">{user?.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                data-testid="logout-button"
              >
                <SignOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1" data-testid="dashboard-tabs">
            <TabsTrigger value="predict" className="flex items-center gap-2 py-3" data-testid="tab-predict">
              <Flask size={20} />
              <span className="hidden sm:inline">Strength Prediction</span>
              <span className="sm:hidden">Predict</span>
            </TabsTrigger>
            <TabsTrigger value="optimize" className="flex items-center gap-2 py-3" data-testid="tab-optimize">
              <ChartLine size={20} />
              <span className="hidden sm:inline">Mix Optimization</span>
              <span className="sm:hidden">Optimize</span>
            </TabsTrigger>
            <TabsTrigger value="cost" className="flex items-center gap-2 py-3" data-testid="tab-cost">
              <CurrencyDollar size={20} />
              <span className="hidden sm:inline">Cost Calculator</span>
              <span className="sm:hidden">Cost</span>
            </TabsTrigger>
            <TabsTrigger value="carbon" className="flex items-center gap-2 py-3" data-testid="tab-carbon">
              <Leaf size={20} />
              <span className="hidden sm:inline">Carbon Footprint</span>
              <span className="sm:hidden">Carbon</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="predict" className="space-y-6">
            <StrengthPrediction />
          </TabsContent>
          <TabsContent value="optimize" className="space-y-6">
            <MixOptimization />
          </TabsContent>
          <TabsContent value="cost" className="space-y-6">
            <CostCalculator />
          </TabsContent>
          <TabsContent value="carbon" className="space-y-6">
            <CarbonCalculator />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};