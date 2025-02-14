import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/custom-card';

const SummaryPage = () => {
  const balanceInfo = [
    {
      label: "XRP Balance",
      value: "25.858151",
      change: "+2.3%",
      positive: true
    },
    {
      label: "PFT Balance",
      value: "9,886.0",
      change: "-0.5%",
      positive: false
    }
  ];

  const accountDetails = [
    {
      label: "Account Address",
      value: "rUVbcDdnAdWXuHkeHihfGweXjVNovraEeu",
      copyable: true
    },
    {
      label: "Default Node",
      value: "r4yc85M1hwsegVGZ1pawpZPwj65SVs8PzD",
      copyable: true
    }
  ];

  const recentActivity = [
    {
      type: "Incoming",
      id: "2025-01-18_15:08__ZB22",
      status: "Proposed",
      message: "Create a dynamic route for node status verification. Include performance metrics and network health indicators.",
      timestamp: "2025-02-07 08:54:01"
    },
    {
      type: "Outgoing",
      id: "2025-01-22_17:16__FN34",
      status: "Completed",
      message: "Implementation of automated testing framework for API endpoints completed successfully.",
      timestamp: "2025-01-22 17:07:11"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-6">
        {balanceInfo.map((item) => (
          <Card key={item.label} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-400">{item.label}</p>
                  <p className="text-2xl font-semibold text-white mt-1">{item.value}</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${item.positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {item.change}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Account Details */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {accountDetails.map((item) => (
              <div key={item.label} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50">
                <div>
                  <p className="text-sm font-medium text-slate-400">{item.label}</p>
                  <p className="text-sm font-mono text-slate-200 mt-1">{item.value}</p>
                </div>
                {item.copyable && (
                  <button className="p-2 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((item) => (
              <div key={item.id} className="p-4 rounded-lg bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-400">{item.type}</span>
                    <span className="text-xs font-mono text-slate-500">{item.id}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                    {item.status}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-2">{item.message}</p>
                <p className="text-xs text-slate-500">{item.timestamp}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SummaryPage;