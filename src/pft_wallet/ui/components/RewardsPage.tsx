import React from 'react';

const RewardsPage = () => {
//  const [activeTab, setActiveTab] = useState('rewards');
  

  const rewardsData = [
    {
      id: 1,
      taskId: '2025-01-22_14:16__RD88',
      proposal: 'Create a TypeScript component intro_section.tsx that implements the main landing section for PosiFiat\'s website. Include concise explanations of what PosiFiat is, why it matters, and how AI-based distribution works. Add responsive styling using Tailwind CSS and implement unit tests verifying proper rendering across different viewport sizes... 900',
      reward: 'The submission demonstrates excellent completion of all task requirements with strong verification. The code implementation shows proper use of Tailwind responsive classes, component structure, and comprehensive unit testing. The verification response directly addresses the prompt with specific technical details that match the provided code. The internal documentation provides complete evidence of implementation including both component and test code.',
      payout: '900.0'
    },
    {
      id: 2,
      taskId: '2025-01-20_17:08__OH66',
      proposal: 'Create a Python script that updates the RequestHandler class in request.py to implement standardized memo construction. Add methods for handling CorbanuType.CORBANU_REQUEST transactions with StandardizedMemoProcessor integration, including proper parameter initialization and compression settings. Include unit tests verifying consistent memo formatting and transaction processing... 900',
      reward: 'The submission demonstrates complete implementation of the requested functionality with thorough verification through both code snippets and unit tests. The user has provided strong evidence of proper StandardizedMemoProcessor integration, parameter handling, and comprehensive test coverage. The implementation includes proper error handling and follows best practices for memo construction. The verification response aligns with the provided code implementation, showing consistency and attention to detail.',
      payout: '900.0'
    },
    {
      id: 3,
      taskId: '2025-01-18_15:10__BK33',
      proposal: 'Create a Python script that updates the record_question method in corbanu_node.py to use StandardizedMemoProcessor. Implement MemoConstructionParameters handling, add StandardizedMemoProcessor.construct_group_generic() integration, and include unit tests verifying proper memo processing. Document the implementation with example usage... 900',
      reward: 'The user has provided comprehensive evidence of implementing the requested functionality in the corbanu_node.py file.',
      payout: '1.0'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-200">PftPyClient v0.2.5</h1>
      </div>


      {/* Main Content */}
      <div className="space-y-6">
        {/* Rewards Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-4 text-gray-400 font-normal">#</th>
                <th className="p-4 text-gray-400 font-normal">Task ID</th>
                <th className="p-4 text-gray-400 font-normal">Proposal</th>
                <th className="p-4 text-gray-400 font-normal">Reward</th>
                <th className="p-4 text-gray-400 font-normal">Payout</th>
              </tr>
            </thead>
            <tbody>
              {rewardsData.map((row) => (
                <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="p-4 text-gray-300 align-top w-12">{row.id}</td>
                  <td className="p-4 text-gray-300 font-mono align-top whitespace-nowrap">
                    {row.taskId}
                  </td>
                  <td className="p-4 text-gray-300 align-top max-w-md">
                    <div className="line-clamp-4">
                      {row.proposal}
                    </div>
                  </td>
                  <td className="p-4 text-gray-300 align-top max-w-lg">
                    <div className="line-clamp-4">
                      {row.reward}
                    </div>
                  </td>
                  <td className="p-4 text-gray-300 align-top whitespace-nowrap">
                    {row.payout}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Status */}
      <div className="fixed bottom-0 left-0 right-0 flex justify-between p-2 bg-gray-800 text-gray-400 text-sm">
        <span>Wallet state: idle</span>
        <span>IDLE</span>
      </div>
    </div>
  );
};

export default RewardsPage;