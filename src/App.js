import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Sheet, DollarSign, Percent, Info, TrendingUp, AlertCircle, Loader, ExternalLink, PieChart as PieChartIcon, ChevronsRight, Award, X, Calendar, Repeat, Download, FileText, RefreshCw, ClipboardList, CheckCircle2, Zap, TrendingDown, Eye, Trash2, Briefcase, Edit, Landmark, Target, PlusCircle, Trash, Shield, BarChart2, Activity, AlertTriangle, GitCommit, Link, Sparkles, ArrowLeftRight, Menu, Home as HomeIcon, LayoutDashboard, BookOpen, Handshake } from 'lucide-react';

// --- Colors for Charts ---
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff4d4d', '#4BC0C0', '#9966FF', '#FF6384', '#36A2EB'];
const ALLOCATION_COLORS = { 'Growth': '#22c55e', 'Balanced': '#facc15', 'Conservative': '#3b82f6' };


// --- Calculation Engine ---
const calculatePayoff = (debts, strategy, extraPayment = 0, snowflakePayments = [], targetDebt = 'strategy') => {
    if (!debts || debts.length === 0) return { history: [], months: 0, totalInterest: 0, amortization: [], debtPayoffDates: {} };

    let currentDebts = JSON.parse(JSON.stringify(debts)).map(d => ({...d, id: d['Debt Name'], interestPaid: 0, amortization: [] }));
    let history = [];
    let month = 0;
    let totalInterestPaid = 0;
    let debtPayoffDates = {};

    // Initial state at month 0
    const initialHistoryEntry = { month: 0, totalBalance: currentDebts.reduce((sum, d) => sum + d.Balance, 0) };
    currentDebts.forEach(debt => { initialHistoryEntry[debt.id] = debt.Balance; });
    history.push(initialHistoryEntry);

    while (currentDebts.some(d => d.Balance > 0)) {
        month++;
        let monthlyPaymentPool = currentDebts.reduce((sum, d) => sum + d['minimum payment'], 0) + extraPayment;
        
        const snowflake = snowflakePayments.find(s => s.month === month);
        if (snowflake) { monthlyPaymentPool += snowflake.amount; }

        currentDebts.forEach(debt => {
            if (debt.Balance > 0) {
                const monthlyInterest = (debt.Balance * (debt.APR / 100)) / 12;
                debt.Balance += monthlyInterest;
                totalInterestPaid += monthlyInterest;
                debt.interestPaid += monthlyInterest;
            }
        });
        
        for(const debt of currentDebts) {
            if (debt.Balance > 0) {
                const minPayment = Math.min(debt.Balance, debt['minimum payment']);
                debt.Balance -= minPayment;
                monthlyPaymentPool -= minPayment;
                debt.amortization.push({ month, payment: minPayment, interest: (debt.Balance * (debt.APR / 100)) / 12, principal: minPayment - ((debt.Balance * (debt.APR / 100)) / 12), balance: debt.Balance });
            }
        }

        let basePaymentOrder = strategy === 'avalanche' 
            ? [...currentDebts].sort((a, b) => b.APR - a.APR || a.Balance - b.Balance) 
            : [...currentDebts].sort((a, b) => a.Balance - b.Balance || b.APR - a.APR);
        
        let extraPaymentOrder;
        if (targetDebt !== 'strategy' && currentDebts.find(d => d.id === targetDebt && d.Balance > 0)) {
            extraPaymentOrder = [ currentDebts.find(d => d.id === targetDebt), ...basePaymentOrder.filter(d => d.id !== targetDebt) ].filter(Boolean);
        } else {
            extraPaymentOrder = basePaymentOrder;
        }

        for (const debt of extraPaymentOrder) {
            if (monthlyPaymentPool <= 0) break;
            if (debt.Balance > 0) {
                const extraPaid = Math.min(monthlyPaymentPool, debt.Balance);
                debt.Balance -= extraPaid;
                monthlyPaymentPool -= extraPaid;
                const lastAmort = debt.amortization.find(a => a.month === month);
                if (lastAmort) {
                    lastAmort.payment += extraPaid;
                    lastAmort.principal += extraPaid;
                    lastAmort.balance = debt.Balance;
                } else {
                     debt.amortization.push({ month, payment: extraPaid, interest: 0, principal: extraPaid, balance: debt.Balance });
                }
            }
        }
        
        currentDebts.forEach(debt => {
            if (debt.Balance <= 0 && !debtPayoffDates[debt.id]) {
                debtPayoffDates[debt.id] = month;
            }
        });

        const historyEntry = { month, totalBalance: currentDebts.reduce((sum, d) => sum + d.Balance, 0) };
        currentDebts.forEach(debt => { historyEntry[debt.id] = debt.Balance > 0 ? debt.Balance : 0; });
        history.push(historyEntry);
        
        if (month > 1200) break; // Safety break
    }

    return { history, months: month, totalInterest: totalInterestPaid, amortization: currentDebts, debtPayoffDates };
};

// --- Reusable Tooltip Component ---
const Tooltip = ({ text, children }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
            {children}
            {show && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-gray-800 text-white text-xs rounded-lg p-3 z-50 shadow-lg transition-opacity duration-300">
                    {text}
                </div>
            )}
        </div>
    );
};

// --- Child Components defined outside App for stability ---

const Instructions = () => ( <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md mb-6 shadow-sm"> <h3 className="text-lg font-semibold flex items-center"><Info className="h-6 w-6 mr-3" />How to use this tool</h3> <div className="text-sm space-y-2 mt-2"> <p>This tool visualizes your financial data from Google Sheets. To get started:</p> <p>1. <strong>Use the Template:</strong> Start by making a copy of the official <a href="https://docs.google.com/spreadsheets/d/1hD7oQM8cgB9EBhs1wHuBgaSFOwLH1a_TGg4jU84vfFw/edit?usp=sharing" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">Template Sheet <ExternalLink className="h-3 w-3 ml-1 inline"/></a>. It has the required tabs.</p> <p>2. <strong>Get Your Link:</strong> Inside your copied sheet, find the new menu item: <code className="bg-blue-100 text-blue-800 px-1 rounded">Smart Steps Menu</code> &rarr; <code className="bg-blue-100 text-blue-800 px-1 rounded">Get Web App Link</code>. The first time you click this, you will need to authorize the script.</p> <p>3. <strong>Paste Your Link Above:</strong> Copy the single link provided in the dialog box and paste it into the input field above.</p></div></div> );
const StatCard = ({ icon, title, value, baseValue, color, tooltipText, description }) => ( <div className="bg-white p-4 rounded-lg shadow-md transition-transform hover:scale-105 hover:-translate-y-1"> <div className="flex items-center"> <div className={`p-3 rounded-full mr-4 ${color}`}>{icon}</div> <div> <div className="flex items-center"> <p className="text-sm text-gray-500">{title}</p> {tooltipText && ( <Tooltip text={tooltipText}> <Info size={14} className="ml-1.5 text-gray-400 hover:text-gray-600 cursor-pointer" /> </Tooltip> )} </div> <p className="text-2xl font-bold text-gray-800">{value}</p> </div> </div> {baseValue && value !== baseValue && ( <div className="mt-2 text-sm text-center"> <span className="text-gray-500 line-through">{baseValue}</span> <ChevronsRight className="inline h-4 w-4 mx-1 text-green-500" /> <span className="font-bold text-green-600">{value}</span> </div> )} {description && <p className="text-xs text-gray-500 mt-2">{description}</p>}</div> );
const ImpactModal = ({ impactData, setShowImpactModal }) => ( <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full text-center relative"> <button onClick={() => setShowImpactModal(false)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"><X /></button> <Award className="h-16 w-16 text-yellow-400 mx-auto mb-4" /> <h2 className="text-2xl font-bold text-gray-800 mb-2">Amazing!</h2> <p className="text-lg text-gray-600">That <span className="font-bold text-green-600">${impactData.amount.toLocaleString()}</span> payment made a huge difference!</p> <div className="mt-6 space-y-3"> <div className="bg-green-50 p-3 rounded-lg"> <p className="text-sm text-green-800">You'll be debt-free</p> <p className="text-xl font-bold text-green-600">{impactData.monthsSaved} months sooner!</p> </div> <div className="bg-blue-50 p-3 rounded-lg"> <p className="text-sm text-blue-800">You'll save an extra</p> <p className="text-xl font-bold text-blue-600">${impactData.interestSaved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in interest!</p> </div> </div> </div> </div> );
const AmortizationModal = ({ amortizationData, setShowAmortizationModal }) => ( <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl p-6 max-w-2xl w-full text-center relative"> <button onClick={() => setShowAmortizationModal(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><X /></button> <h2 className="text-2xl font-bold text-gray-800 mb-4">Amortization Schedule for {amortizationData?.id}</h2> <div className="overflow-y-auto h-96"><table className="w-full text-sm text-left"><thead className="bg-gray-100 text-xs text-gray-700 uppercase sticky top-0"><tr><th className="p-2">Month</th><th className="p-2 text-right">Payment</th><th className="p-2 text-right">Principal</th><th className="p-2 text-right">Interest</th><th className="p-2 text-right">Remaining Balance</th></tr></thead><tbody>{amortizationData?.amortization.map(row => ( <tr key={row.month} className="border-b"><td className="p-2">{row.month}</td><td className="p-2 text-right">${row.payment.toFixed(2)}</td><td className="p-2 text-right">${row.principal.toFixed(2)}</td><td className="p-2 text-right">${row.interest.toFixed(2)}</td><td className="p-2 text-right">${row.balance.toFixed(2)}</td></tr>))}</tbody></table></div></div></div> );
const StrategyCard = ({ title, description, value, icon, selected, setStrategy }) => ( <div onClick={() => setStrategy(value)} className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}> <div className="flex justify-between items-center"> <div className="flex items-center"> {icon} <h4 className="font-bold ml-2">{title}</h4> </div> {selected && <CheckCircle2 className="text-blue-500" />} </div> <p className="text-sm text-gray-600 mt-1">{description}</p> </div> );
const dtiTooltipText = ( <div className="text-left space-y-2"> <p>Your Debt-to-Income (DTI) ratio is all your monthly debt payments divided by your gross monthly income. Lenders use it to measure your ability to manage payments.</p> <div> <p className="font-bold">General Guidelines:</p> <ul className="list-disc list-inside text-xs"> <li><span className="font-semibold text-green-400">36% or less:</span> Optimal</li> <li><span className="font-semibold text-yellow-400">37% to 42%:</span> Manageable</li> <li><span className="font-semibold text-orange-400">43% to 49%:</span> Cause for concern</li> <li><span className="font-semibold text-red-400">50% or more:</span> Dangerous</li> </ul> </div> </div> );

const InvestmentGrowthCalculator = ({ startingAmount: initialStartingAmount, isForPdf = false }) => {
    const [startingAmount, setStartingAmount] = useState(initialStartingAmount);
    const [monthlyContribution, setMonthlyContribution] = useState(500);
    const [annualReturn, setAnnualReturn] = useState(7);
    const [yearsToGrow, setYearsToGrow] = useState(20);

    useEffect(() => {
        setStartingAmount(initialStartingAmount);
    }, [initialStartingAmount]);
    
    const projectionData = useMemo(() => {
        const data = [];
        let currentValue = startingAmount;
        const monthlyReturnRate = (annualReturn / 100) / 12;

        for (let year = 0; year <= yearsToGrow; year++) {
            data.push({ year: `Year ${year}`, value: currentValue });
            if (year < yearsToGrow) {
                for (let month = 1; month <= 12; month++) {
                    currentValue = (currentValue + monthlyContribution) * (1 + monthlyReturnRate);
                }
            }
        }
        return data;
    }, [startingAmount, monthlyContribution, annualReturn, yearsToGrow]);

    return (
        <div id="investment-growth-projection" className="bg-white p-6 rounded-lg shadow-md mt-8">
            <h3 className="text-xl font-bold mb-4">Investment Growth Projection</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                    <label className="text-sm font-medium text-gray-700">Starting Principal</label>
                    <div className="relative mt-1">
                         <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
                         <input type="number" value={startingAmount} onChange={e => setStartingAmount(Number(e.target.value))} className="w-full pl-8 border-gray-300 rounded-md shadow-sm"/>
                    </div>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Monthly Contribution</label>
                    <div className="relative mt-1">
                         <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
                         <input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} className="w-full pl-8 border-gray-300 rounded-md shadow-sm"/>
                    </div>
                </div>
                 <div>
                    <label className="text-sm font-medium text-gray-700">Est. Annual Return (%)</label>
                    <div className="relative mt-1">
                         <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
                         <input type="number" value={annualReturn} onChange={e => setAnnualReturn(Number(e.target.value))} className="w-full pl-8 border-gray-300 rounded-md shadow-sm"/>
                    </div>
                </div>
                 <div>
                    <label className="text-sm font-medium text-gray-700">Years to Project</label>
                    <div className="relative mt-1">
                         <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
                         <input type="number" value={yearsToGrow} onChange={e => setYearsToGrow(Number(e.target.value))} className="w-full pl-8 border-gray-300 rounded-md shadow-sm"/>
                    </div>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={projectionData} isAnimationActive={!isForPdf}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(value) => `$${(value/1000).toLocaleString()}k`} />
                    <RechartsTooltip formatter={(value) => `$${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`} />
                    <Legend />
                    <Line type="monotone" dataKey="value" name="Projected Value" stroke="#14b8a6" strokeWidth={3} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

 const RetirementReadinessSimulator = ({ startingAmount }) => {
    const [currentAge, setCurrentAge] = useState(30);
    const [retirementAge, setRetirementAge] = useState(65);
    const [targetAnnualIncome, setTargetAnnualIncome] = useState(80000);
    const [monthlyContribution, setMonthlyContribution] = useState(500);
    const [annualReturn, setAnnualReturn] = useState(7);

    const { requiredNestEgg, projectedValue, shortfall, surplus } = useMemo(() => {
        const yearsToGrow = retirementAge - currentAge;
        if (yearsToGrow <= 0) return { requiredNestEgg: 0, projectedValue: startingAmount, shortfall: 0, surplus: 0};

        const requiredNestEgg = targetAnnualIncome * 25; // 4% rule

        let projectedValue = startingAmount;
        const monthlyReturnRate = (annualReturn / 100) / 12;
        const totalMonths = yearsToGrow * 12;

        for (let month = 1; month <= totalMonths; month++) {
            projectedValue = (projectedValue + monthlyContribution) * (1 + monthlyReturnRate);
        }
        
        const difference = projectedValue - requiredNestEgg;
        const shortfall = difference < 0 ? Math.abs(difference) : 0;
        const surplus = difference > 0 ? difference : 0;

        return { requiredNestEgg, projectedValue, shortfall, surplus };
    }, [startingAmount, currentAge, retirementAge, targetAnnualIncome, monthlyContribution, annualReturn]);
    
    const simulatorTooltipText = (
        <div className="text-left space-y-2">
            <p>This tool estimates if you're on track for retirement based on your inputs.</p>
            <p className="font-bold">Required Nest Egg:</p>
            <p>Calculated using the 25x rule, which is your Target Annual Income multiplied by 25. This is based on the 4% safe withdrawal rate.</p>
            <p className="font-bold">Projected Portfolio:</p>
            <p>Forecasts the future value of your investments based on your current age, retirement age, contributions, and estimated return.</p>
        </div>
    );

    return (
        <div id="retirement-readiness-simulator" className="bg-white p-6 rounded-lg shadow-md mt-8">
            <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xl font-bold">Retirement Readiness Simulator</h3>
                <Tooltip text={simulatorTooltipText}>
                    <Info size={16} className="text-gray-400 cursor-pointer" />
                </Tooltip>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <div><label className="text-sm font-medium text-gray-700">Current Age</label><input type="number" value={currentAge} onChange={e => setCurrentAge(Number(e.target.value))} className="mt-1 w-full border-gray-300 rounded-md shadow-sm"/></div>
                <div><label className="text-sm font-medium text-gray-700">Retirement Age</label><input type="number" value={retirementAge} onChange={e => setRetirementAge(Number(e.target.value))} className="mt-1 w-full border-gray-300 rounded-md shadow-sm"/></div>
                <div><label className="text-sm font-medium text-gray-700">Target Annual Income</label><div className="relative mt-1"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/><input type="number" value={targetAnnualIncome} onChange={e => setTargetAnnualIncome(Number(e.target.value))} className="w-full pl-8 border-gray-300 rounded-md shadow-sm"/></div></div>
                <div><label className="text-sm font-medium text-gray-700">Monthly Contribution</label><div className="relative mt-1"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/><input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} className="w-full pl-8 border-gray-300 rounded-md shadow-sm"/></div></div>
                <div><label className="text-sm font-medium text-gray-700">Est. Annual Return (%)</label><div className="relative mt-1"><Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/><input type="number" value={annualReturn} onChange={e => setAnnualReturn(Number(e.target.value))} className="w-full pl-8 border-gray-300 rounded-md shadow-sm"/></div></div>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div><p className="text-sm text-gray-500">Required Nest Egg</p><p className="text-2xl font-bold text-gray-800">${requiredNestEgg.toLocaleString(undefined, {maximumFractionDigits: 0})}</p></div>
                    <div><p className="text-sm text-gray-500">Projected Portfolio</p><p className="text-2xl font-bold text-gray-800">${projectedValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p></div>
                    <div>
                        {surplus > 0 && <><p className="text-sm text-green-600">Projected Surplus</p><p className="text-2xl font-bold text-green-600">${surplus.toLocaleString(undefined, {maximumFractionDigits: 0})}</p></>}
                        {shortfall > 0 && <><p className="text-sm text-red-600">Projected Shortfall</p><p className="text-2xl font-bold text-red-600">${shortfall.toLocaleString(undefined, {maximumFractionDigits: 0})}</p></>}
                    </div>
                </div>
            </div>
        </div>
    )
}

const FinancialGoalSetting = ({ portfolioValue, goals, setGoals, financialSummary }) => {
    const [goalName, setGoalName] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [generatingPlanId, setGeneratingPlanId] = useState(null);

    const addGoal = () => {
        if (goalName && targetAmount && targetDate) {
            setGoals([...goals, { id: Date.now(), name: goalName, amount: Number(targetAmount), date: targetDate, plan: null }]);
            setGoalName('');
            setTargetAmount('');
            setTargetDate('');
        }
    };

    const removeGoal = (id) => {
        setGoals(goals.filter(goal => goal.id !== id));
    };

    const generatePlan = async (goalId) => {
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return;

        setGeneratingPlanId(goalId);

        const availableCash = financialSummary.totalMonthlyIncome - financialSummary.totalMonthlyBills - financialSummary.totalMinimumPayment;

        const prompt = `
            Create a simple, actionable savings plan for a financial goal.
            Goal Name: "${goal.name}"
            Target Amount: $${goal.amount}
            Target Date: ${goal.date}
            My current available cash for savings per month is approximately $${availableCash.toFixed(2)}.
            
            Provide a short, encouraging plan with 2-3 concrete, realistic steps.
            The tone should be motivational and clear. Start with a positive opening sentence.
            Format the output as plain text, using newlines for paragraphs and bullet points (e.g., using '*' or '-').
        `;

        try {
            let chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });
            const payload = { contents: chatHistory };
            const apiKey = "" 
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            
            let planText = "Could not generate a plan at this time. Please try again later.";
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
              planText = result.candidates[0].content.parts[0].text;
            }

            const updatedGoals = goals.map(g => 
                g.id === goalId ? { ...g, plan: { text: planText } } : g
            );
            setGoals(updatedGoals);

        } catch (error) {
            console.error("Error generating savings plan:", error);
            const updatedGoals = goals.map(g => 
                g.id === goalId ? { ...g, plan: { text: "Error: Could not connect to the AI planning service." } } : g
            );
            setGoals(updatedGoals);
        } finally {
            setGeneratingPlanId(null);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md mt-8">
            <h3 className="text-xl font-bold mb-4">Financial Goals</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg">
                <input type="text" value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="Goal Name (e.g., House Down Payment)" className="border-gray-300 rounded-md shadow-sm"/>
                <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="Target Amount" className="border-gray-300 rounded-md shadow-sm"/>
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="border-gray-300 rounded-md shadow-sm"/>
                <button onClick={addGoal} className="bg-teal-500 text-white font-bold rounded-md hover:bg-teal-600 flex items-center justify-center gap-2"><PlusCircle size={16}/> Add Goal</button>
            </div>

            <div className="space-y-4">
                {goals.map(goal => {
                    const progress = Math.min((portfolioValue / goal.amount) * 100, 100);
                    return (
                        <div key={goal.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold">{goal.name}</h4>
                                    <p className="text-sm text-gray-600">${goal.amount.toLocaleString()} by {new Date(goal.date).toLocaleDateString()}</p>
                                </div>
                                <button onClick={() => removeGoal(goal.id)} className="text-red-500 hover:text-red-700"><Trash size={16}/></button>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                <div className="bg-teal-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                            <div className="text-right text-xs mt-1">{progress.toFixed(0)}% Funded</div>
                            
                            <button 
                                onClick={() => generatePlan(goal.id)} 
                                disabled={generatingPlanId === goal.id}
                                className="text-sm font-semibold text-teal-600 hover:underline mt-2 flex items-center gap-1 disabled:opacity-50"
                            >
                                {generatingPlanId === goal.id ? <Loader className="animate-spin h-4 w-4" /> : <Sparkles size={14} className="text-yellow-500" />}
                                {generatingPlanId === goal.id ? 'Generating...' : '✨ Generate Savings Plan'}
                            </button>
                            
                            {goal.plan && (
                                <div className="mt-2 p-3 bg-teal-50/50 rounded-lg border border-teal-200">
                                    <h5 className="font-bold text-teal-800 mb-2 flex items-center gap-2"><Sparkles size={16} /> AI Savings Plan</h5>
                                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{goal.plan.text}</div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

const RiskToleranceQuiz = ({ onQuizComplete }) => {
    const questions = [
        {
            question: "When you think about investing, what is your primary goal?",
            options: [
                { text: "Preserving my capital is most important.", value: 1 },
                { text: "A mix of growth and capital preservation.", value: 2 },
                { text: "Maximizing long-term growth, even with some risk.", value: 3 }
            ]
        },
        {
            question: "How would you react to a 20% drop in your portfolio's value in a single year?",
            options: [
                { text: "Panic and sell everything.", value: 1 },
                { text: "Feel concerned, but wait it out.", value: 2 },
                { text: "See it as a buying opportunity.", value: 3 }
            ]
        },
        {
            question: "What is your investment time horizon?",
            options: [
                { text: "Short-term (less than 3 years)", value: 1 },
                { text: "Medium-term (3-10 years)", value: 2 },
                { text: "Long-term (more than 10 years)", value: 3 }
            ]
        },
        {
            question: "How much of your portfolio are you comfortable allocating to higher-risk assets like stocks?",
            options: [
                { text: "Less than 25%", value: 1 },
                { text: "25% to 75%", value: 2 },
                { text: "More than 75%", value: 3 }
            ]
        },
        {
            question: "How would you describe your knowledge of investments?",
            options: [
                { text: "Beginner", value: 1 },
                { text: "Intermediate", value: 2 },
                { text: "Advanced", value: 3 }
            ]
        }
    ];

    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState({});
    const [showResult, setShowResult] = useState(false);

    const handleAnswer = (questionIndex, value) => {
        setAnswers({ ...answers, [questionIndex]: value });
    };

    const calculateResult = () => {
        const totalScore = Object.values(answers).reduce((sum, value) => sum + value, 0);
        let profile;
        if (totalScore <= 6) {
            profile = { name: "Conservative", description: "Prefers safety and capital preservation over high returns.", icon: Shield, color: "bg-blue-500" };
        } else if (totalScore <= 11) {
            profile = { name: "Moderate", description: "Seeks a balance between growth and risk, comfortable with some fluctuations.", icon: BarChart2, color: "bg-yellow-500" };
        } else {
            profile = { name: "Aggressive", description: "Focuses on maximizing long-term returns and is comfortable with significant market volatility.", icon: Activity, color: "bg-red-500" };
        }
        onQuizComplete(profile);
        setShowResult(true);
    };

    const nextQuestion = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        } else {
            calculateResult();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-lg w-full relative">
                {!showResult ? (
                    <>
                        <button onClick={() => onQuizComplete(null, true)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"><X /></button>
                        <h3 className="text-xl font-bold mb-2">Question {currentQuestion + 1}/{questions.length}</h3>
                        <p className="text-lg text-gray-700 mb-6">{questions[currentQuestion].question}</p>
                        <div className="space-y-3">
                            {questions[currentQuestion].options.map((option, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleAnswer(currentQuestion, option.value)}
                                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${answers[currentQuestion] === option.value ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}
                                >
                                    {option.text}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-end mt-6">
                            <button
                                onClick={nextQuestion}
                                disabled={answers[currentQuestion] === undefined}
                                className="bg-teal-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {currentQuestion < questions.length - 1 ? "Next" : "Finish"}
                            </button>
                        </div>
                    </>
                ) : (
                     <div className="text-center">
                         <h2 className="text-2xl font-bold text-gray-800 mb-2">Quiz Complete!</h2>
                         <button onClick={() => onQuizComplete(null, true)} className="mt-6 bg-teal-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-teal-700">Done</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const InvestmentPortfolioView = ({ data, riskProfile, setRiskProfile, goals, setGoals, generateInvestmentPDF, investmentPdfLoading, pdfLibrariesLoaded, totalValue, simplifiedAllocation, financialSummary }) => {
    const [showQuiz, setShowQuiz] = useState(false);

    const targetAllocations = {
        Conservative: [{ name: 'Growth', value: 25 }, { name: 'Balanced', value: 40 }, { name: 'Conservative', value: 35 }],
        Moderate: [{ name: 'Growth', value: 60 }, { name: 'Balanced', value: 30 }, { name: 'Conservative', value: 10 }],
        Aggressive: [{ name: 'Growth', value: 85 }, { name: 'Balanced', value: 10 }, { name: 'Conservative', value: 5 }],
    };

    const {
        weightedExpenseRatio,
        annualFees,
        projectedDividendIncome,
        allocationByAccountType,
        hasFeeData,
        hasDividendData,
        hasAccountTypeData
    } = useMemo(() => {
        if (!data || data.length === 0) return {
            weightedExpenseRatio: 0,
            annualFees: 0,
            projectedDividendIncome: 0,
            allocationByAccountType: [],
            hasFeeData: false,
            hasDividendData: false,
            hasAccountTypeData: false
        };

        const totalFees = data.reduce((acc, item) => {
            const ratio = item['Expense Ratio (%)'] || 0;
            const value = item.Value || 0;
            return acc + (value * (ratio / 100));
        }, 0);
        const weightedRatio = totalValue > 0 ? (totalFees / totalValue) * 100 : 0;

        const totalDividends = data.reduce((acc, item) => {
            const yieldVal = item['Dividend Yield (%)'] || 0;
            const value = item.Value || 0;
            return acc + (value * (yieldVal / 100));
        }, 0);

        const accounts = {};
        data.forEach(item => {
            const accountType = item['Account Type'] || 'Uncategorized';
            if (!accounts[accountType]) {
                accounts[accountType] = 0;
            }
            accounts[accountType] += item.Value || 0;
        });
        const accountAllocation = Object.keys(accounts).map(name => ({ name, value: accounts[name] }));

        const hasFeeData = data.some(item => item.hasOwnProperty('Expense Ratio (%)'));
        const hasDividendData = data.some(item => item.hasOwnProperty('Dividend Yield (%)'));
        const hasAccountTypeData = data.some(item => item.hasOwnProperty('Account Type') && item['Account Type']);


        return {
            weightedExpenseRatio: weightedRatio,
            annualFees: totalFees,
            projectedDividendIncome: totalDividends,
            allocationByAccountType: accountAllocation.filter(a => a.value > 0),
            hasFeeData,
            hasDividendData,
            hasAccountTypeData
        };
    }, [data, totalValue]);

    const handleQuizComplete = (profile, close = false) => {
        if (profile) setRiskProfile(profile);
        if (close) setShowQuiz(false);
    };

    const RebalancingSuggestions = () => {
        if (!riskProfile || totalValue <= 0) return null;
    
        const currentAllocationMap = new Map(simplifiedAllocation.map(item => [item.name, (item.value / totalValue) * 100]));
        const targetAllocationMap = new Map(targetAllocations[riskProfile.name].map(item => [item.name, item.value]));
        
        const categories = ['Growth', 'Balanced', 'Conservative'];
        const allocationDiffs = categories.map(name => {
            const currentPercent = currentAllocationMap.get(name) || 0;
            const targetPercent = targetAllocationMap.get(name) || 0;
            return {
                name,
                diff: currentPercent - targetPercent,
                currentValue: (currentPercent / 100) * totalValue,
                targetValue: (targetPercent / 100) * totalValue
            };
        });
    
        const needsRebalancing = allocationDiffs.some(d => Math.abs(d.diff) > 5);
    
        if (!needsRebalancing) {
            return (
                 <div className="mt-6 p-4 rounded-lg flex items-start gap-4 bg-green-100 text-green-800">
                    <CheckCircle2 className="h-6 w-6 mt-1 flex-shrink-0" />
                    <p className="text-sm">Your portfolio's allocation is well-aligned with your risk profile. No rebalancing needed at this time.</p>
                </div>
            );
        }
        
        const toSell = allocationDiffs.filter(d => d.diff > 5);
        const toBuy = allocationDiffs.filter(d => d.diff < -5);

        const rebalancingTooltip = (
            <div className="text-left space-y-2">
                <p><strong className="text-green-400">Growth:</strong> Higher potential returns, higher risk. <br/><em>E.g., Individual Stocks, Crypto, Growth ETFs.</em></p>
                <p><strong className="text-yellow-400">Balanced:</strong> A mix of growth and stability. <br/><em>E.g., Index Funds (S&P 500), Mutual Funds, REITs.</em></p>
                <p><strong className="text-blue-400">Conservative:</strong> Lower risk, focus on capital preservation. <br/><em>E.g., Bonds, Cash, CDs, Money Market.</em></p>
            </div>
        );
    
        return (
            <div className="mt-4 p-4 border-2 border-orange-300 bg-orange-50 rounded-lg">
                <div className="flex items-start gap-3">
                    <GitCommit className="h-6 w-6 text-orange-600 flex-shrink-0" />
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-orange-800">Rebalancing Actions Suggested</h4>
                            <Tooltip text={rebalancingTooltip}>
                                <Info size={16} className="text-gray-400 cursor-pointer" />
                            </Tooltip>
                        </div>
                        <p className="text-sm text-orange-700 mt-1">Your portfolio has drifted from its target. Consider the following actions to realign with your '{riskProfile.name}' profile:</p>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {toSell.length > 0 && (
                        <div>
                            <p className="font-semibold mb-2 text-red-600">Consider Selling:</p>
                            <ul className="space-y-1">
                                {toSell.map(item => (
                                    <li key={item.name}>
                                        ~${(item.currentValue - item.targetValue).toLocaleString(undefined, {maximumFractionDigits:0})} of <span className="font-medium">{item.name}</span> assets.
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {toBuy.length > 0 && (
                        <div>
                            <p className="font-semibold mb-2 text-green-600">Consider Buying:</p>
                             <ul className="space-y-1">
                                {toBuy.map(item => (
                                    <li key={item.name}>
                                        ~${(item.targetValue - item.currentValue).toLocaleString(undefined, {maximumFractionDigits:0})} of <span className="font-medium">{item.name}</span> assets.
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (data.length === 0) {
        return (
            <div className="text-center p-10 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800">Investment Portfolio</h2>
                <p className="text-gray-500 mt-2">No investment data found. Please add a link to your 'Investments' sheet to see your portfolio.</p>
            </div>
        )
    }

    const portfolioTooltipText = (
        <div className="text-left space-y-2">
            <p>This dashboard provides a high-level overview of your investment portfolio.</p>
            <ul className="list-disc list-inside text-xs space-y-1">
                <li><strong>Stat Cards:</strong> Summarize your total value, projected dividend income, and estimated annual fees based on your funds' expense ratios.</li>
                <li><strong>Risk Profile:</strong> Assess your risk tolerance to get a suggested asset allocation.</li>
                <li><strong>Allocation Charts:</strong> Visualize your current portfolio breakdown vs. your target and see your holdings by account type.</li>
            </ul>
        </div>
    );

    return (
        <>
            {showQuiz && <RiskToleranceQuiz onQuizComplete={handleQuizComplete} />}
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-800">Investment Portfolio</h2>
                    <Tooltip text={portfolioTooltipText}>
                        <Info size={16} className="text-gray-400 cursor-pointer" />
                    </Tooltip>
                </div>
                <button
                    onClick={generateInvestmentPDF}
                    disabled={!pdfLibrariesLoaded || investmentPdfLoading}
                    className="mt-4 md:mt-0 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {investmentPdfLoading ? <Loader className="animate-spin h-4 w-4" /> : <Download size={16}/>}
                    {investmentPdfLoading ? 'Generating...' : 'Download Report'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard 
                    icon={<Landmark className="h-6 w-6 text-white"/>} 
                    title="Total Portfolio Value" 
                    value={`$${totalValue.toLocaleString(undefined, {maximumFractionDigits: 2})}`} 
                    color="bg-teal-500"
                    tooltipText="This is the total current market value of all the investments listed in your 'Investments' sheet."
                />
                {hasDividendData && <StatCard 
                    icon={<DollarSign className="h-6 w-6 text-white"/>} 
                    title="Projected Annual Dividend" 
                    value={`$${projectedDividendIncome.toLocaleString(undefined, {maximumFractionDigits: 2})}`} 
                    color="bg-sky-500" 
                    tooltipText="An estimation of the total dividends you'll receive in a year, based on the 'Dividend Yield (%)' you provided for each investment."
                />}
                {hasFeeData && <StatCard 
                    icon={<Percent className="h-6 w-6 text-white"/>} 
                    title="Weighted Expense Ratio" 
                    value={`${weightedExpenseRatio.toFixed(3)}%`} 
                    color="bg-amber-500" 
                    tooltipText="The average expense ratio of your entire portfolio, weighted by the value of each investment. A lower number is better."
                />}
                {hasFeeData && <StatCard 
                    icon={<TrendingDown className="h-6 w-6 text-white"/>} 
                    title="Estimated Annual Fees" 
                    value={`$${annualFees.toLocaleString(undefined, {maximumFractionDigits: 2})}`} 
                    color="bg-red-500" 
                    tooltipText="The approximate amount you'll pay in management fees over a year, calculated from your portfolio's value and the weighted expense ratio."
                />}
                
                {riskProfile ? (
                    <StatCard 
                        icon={React.createElement(riskProfile.icon, {className: "h-6 w-6 text-white"})}
                        title="Your Risk Profile"
                        value={riskProfile.name}
                        color={riskProfile.color}
                        description={riskProfile.description}
                        tooltipText="This is based on your answers to the risk tolerance quiz. It helps determine a target asset allocation that aligns with your comfort level for risk."
                    />
                ) : (
                    <div className="bg-white p-4 rounded-lg shadow-md flex items-center justify-center text-center">
                        <div>
                            <p className="font-bold">Discover Your Investor Type</p>
                            <button onClick={() => setShowQuiz(true)} className="mt-2 bg-teal-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-600 text-sm">Take Risk Quiz</button>
                        </div>
                    </div>
                )}
                <div className="bg-white p-4 rounded-lg shadow-md flex items-center justify-center text-center">
                    <div>
                        <h4 className="font-bold">Strategy Tools</h4>
                        <p className="text-sm text-gray-600 mb-2">Refine your investment approach.</p>
                        <button onClick={() => setShowQuiz(true)} className="bg-teal-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-600 text-sm">
                            {riskProfile ? 'Retake Risk Quiz' : 'Take Risk Quiz'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {riskProfile && (
                    <div id="allocation-comparison-section" className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-bold mb-4">Allocation Comparison</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div className="text-center">
                                <h4 className="font-semibold mb-2">Your Current Allocation</h4>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie data={simplifiedAllocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} isAnimationActive={false}>
                                            {simplifiedAllocation.map((entry) => (<Cell key={entry.name} fill={ALLOCATION_COLORS[entry.name]} />))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value) => `$${value.toLocaleString()}`} />
                                        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ right: -10 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="text-center">
                                <h4 className="font-semibold mb-2">Target for '{riskProfile.name}' Profile</h4>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie data={targetAllocations[riskProfile.name]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${value}%`} isAnimationActive={false}>
                                            {targetAllocations[riskProfile.name].map((entry) => (<Cell key={entry.name} fill={ALLOCATION_COLORS[entry.name]} />))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value) => `${value}%`} />
                                        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ right: -10 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <RebalancingSuggestions />
                    </div>
                )}

                {hasAccountTypeData && (
                    <div id="account-type-chart" className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-bold mb-4">Allocation by Account Type</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={allocationByAccountType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {allocationByAccountType.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                </Pie>
                                <RechartsTooltip formatter={(value) => `$${value.toLocaleString()}`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md mt-8">
                <h3 className="text-xl font-bold mb-4">Investment Details</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm"><thead className="bg-gray-100 text-xs text-gray-700 uppercase"><tr><th className="p-3">Investment Name</th><th className="p-3">Type</th><th className="p-3 text-right">Value</th><th className="p-3 text-right">Expense Ratio</th><th className="p-3 text-right">Dividend Yield</th><th className="p-3">Account Type</th></tr></thead><tbody>{data.map((item, index) => ( <tr key={index} className="border-b hover:bg-gray-50"><td className="p-3 font-medium">{item['Investment Name']}</td><td className="p-3">{item.Type}</td><td className="p-3 text-right">${(item.Value || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="p-3 text-right">{typeof item['Expense Ratio (%)'] === 'number' ? `${item['Expense Ratio (%)']}%` : 'N/A'}</td><td className="p-3 text-right">{typeof item['Dividend Yield (%)'] === 'number' ? `${item['Dividend Yield (%)']}%` : 'N/A'}</td><td className="p-3">{item['Account Type'] || 'N/A'}</td></tr>))}</tbody></table>
                </div>
            </div>
            <FinancialGoalSetting portfolioValue={totalValue} goals={goals} setGoals={setGoals} financialSummary={financialSummary} />
            <InvestmentGrowthCalculator startingAmount={totalValue} isForPdf={investmentPdfLoading} />
            <RetirementReadinessSimulator startingAmount={totalValue} />
        </>
    )
}

const Footer = () => (
    <footer className="mt-12 text-center text-gray-500 text-xs">
        <p>&copy; {new Date().getFullYear()} www.smartstepstowealth.com. All Rights Reserved.</p>
        <p className="mt-2 max-w-2xl mx-auto">
            Disclaimer: This tool is for informational and illustrative purposes only and does not constitute financial, legal, or tax advice. The projections and information provided are based on the data you input and certain assumptions, and are not a guarantee of future results. Please consult with a qualified professional before making any financial decisions.
        </p>
    </footer>
);

const App = () => {
    const [smartStepsUrl, setSmartStepsUrl] = useState('');
    const [debtData, setDebtData] = useState([]);
    const [billData, setBillData] = useState([]);
    const [incomeData, setIncomeData] = useState([]);
    const [investmentData, setInvestmentData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [investmentPdfLoading, setInvestmentPdfLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showInstructions, setShowInstructions] = useState(true);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [currentView, setCurrentView] = useState('debt'); // 'debt' or 'investment'

    const [scenarioMode, setScenarioMode] = useState(false);
    const [strategy, setStrategy] = useState('snowball');
    const [extraMonthlyPayment, setExtraMonthlyPayment] = useState('');
    const [snowflakeAmount, setSnowflakeAmount] = useState('');
    const [snowflakeMonth, setSnowflakeMonth] = useState('');
    const [snowflakePayments, setSnowflakePayments] = useState([]);
    const [targetDebt, setTargetDebt] = useState('strategy');
    const [showImpactModal, setShowImpactModal] = useState(false);
    const [impactData, setImpactData] = useState(null);
    const [showAmortizationModal, setShowAmortizationModal] = useState(false);
    const [amortizationData, setAmortizationData] = useState(null);
    const [pdfLibrariesLoaded, setPdfLibrariesLoaded] = useState(false);
    const [chartView, setChartView] = useState('total'); // 'total' or 'individual'
    const [hiddenDebts, setHiddenDebts] = useState([]); // For chart filtering
    const [riskProfile, setRiskProfile] = useState(null);
    const [goals, setGoals] = useState([]);
    
    // --- Local Storage & Auto-loading ---
    useEffect(() => {
        // Load all saved data from localStorage on initial mount
        const savedUrl = localStorage.getItem('smartStepsUrl');
        const savedRiskProfile = localStorage.getItem('riskProfile');
        const savedGoals = localStorage.getItem('financialGoals');
        const savedExtraPayment = localStorage.getItem('extraMonthlyPayment');
        const savedSnowflakes = localStorage.getItem('snowflakePayments');
        const savedTargetDebt = localStorage.getItem('targetDebt');

        if (savedUrl) setSmartStepsUrl(savedUrl);
        if (savedRiskProfile) setRiskProfile(JSON.parse(savedRiskProfile));
        if (savedGoals) setGoals(JSON.parse(savedGoals));
        if (savedExtraPayment) setExtraMonthlyPayment(savedExtraPayment);
        if (savedSnowflakes) setSnowflakePayments(JSON.parse(savedSnowflakes));
        if (savedTargetDebt) setTargetDebt(savedTargetDebt);

        if (savedUrl) {
            setTimeout(() => processSheetData(savedUrl), 0);
        }
    }, []); // Runs only once on initial component mount

    // --- Save data to localStorage whenever it changes ---
    useEffect(() => { localStorage.setItem('riskProfile', JSON.stringify(riskProfile)); }, [riskProfile]);
    useEffect(() => { localStorage.setItem('financialGoals', JSON.stringify(goals)); }, [goals]);
    useEffect(() => { localStorage.setItem('extraMonthlyPayment', extraMonthlyPayment); }, [extraMonthlyPayment]);
    useEffect(() => { localStorage.setItem('snowflakePayments', JSON.stringify(snowflakePayments)); }, [snowflakePayments]);
    useEffect(() => { localStorage.setItem('targetDebt', targetDebt); }, [targetDebt]);

    const processSheetData = async (url = smartStepsUrl) => {
        if (!url) {
            setError("Please provide your Smart Steps Web App Link.");
            return;
        }
        setLoading(true); setError(null); setDebtData([]); setBillData([]); setIncomeData([]); setInvestmentData([]);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch data. Status: ${response.status}. Please ensure your link is correct and the script is deployed for 'Anyone'.`);
            }
            const data = await response.json();

            if (data.error) {
                throw new Error(`Error from Google Script: ${data.error}`);
            }

            // --- Normalize and Validate Data ---
            const normalize = (arr, requiredCols) => {
                if (!Array.isArray(arr)) return [];
                return arr.map(row => {
                    const normalizedRow = {};
                    for (const col of requiredCols) {
                        const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === col.toLowerCase());
                        let value = foundKey ? row[foundKey] : undefined;

                        // Smart number conversion
                        if (['balance', 'apr', 'minimum payment', 'amount', 'value', 'expense ratio (%)', 'dividend yield (%)'].includes(col.toLowerCase())) {
                            if (typeof value === 'string') {
                                const numericValue = value.replace(/[^0-9.-]+/g,"");
                                value = isNaN(Number(numericValue)) || numericValue === '' ? 0 : Number(numericValue);
                            } else if (typeof value !== 'number') {
                                value = 0;
                            }
                        }
                        normalizedRow[col] = value;
                    }
                    return normalizedRow;
                });
            };

            const debtCols = ['Debt Name', 'Balance', 'APR', 'minimum payment', 'Debt type'];
            setDebtData(normalize(data.debts, debtCols).filter(d => d['Debt Name'] && typeof d['Balance'] === 'number'));

            const billCols = ['Bill Name', 'Amount', 'Category'];
            setBillData(normalize(data.bills, billCols).filter(b => b['Bill Name'] && typeof b['Amount'] === 'number'));

            const incomeCols = ['Income Source', 'Amount', 'Frequency'];
            setIncomeData(normalize(data.income, incomeCols).filter(i => i['Income Source'] && typeof i['Amount'] === 'number'));
            
            const investmentCols = ['Investment Name', 'Value', 'Type', 'Expense Ratio (%)', 'Dividend Yield (%)', 'Account Type'];
            setInvestmentData(normalize(data.investments, investmentCols).filter(i => i['Investment Name'] && typeof i['Value'] === 'number'));
            
            localStorage.setItem('smartStepsUrl', url);
            setShowInstructions(false);
            setIsDataLoaded(true);

        } catch (err) {
            setError(err.message || 'An unknown error occurred while loading data.');
            setIsDataLoaded(false);
        } finally {
            setLoading(false);
        }
    };

    const clearAllData = () => {
        localStorage.removeItem('smartStepsUrl');
        localStorage.removeItem('riskProfile');
        localStorage.removeItem('financialGoals');
        localStorage.removeItem('extraMonthlyPayment');
        localStorage.removeItem('snowflakePayments');
        localStorage.removeItem('targetDebt');
        
        setSmartStepsUrl('');
        setDebtData([]); setBillData([]); setIncomeData([]); setInvestmentData([]);
        setRiskProfile(null);
        setGoals([]);
        setExtraMonthlyPayment('');
        setSnowflakePayments([]);
        setTargetDebt('strategy');

        setShowInstructions(true); setError(null); setIsDataLoaded(false);
    };

    useEffect(() => {
        const loadScripts = () => {
             const html2canvasScript = document.createElement('script');
             html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
             html2canvasScript.onload = () => {
                const jsPdfScript = document.createElement('script');
                jsPdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                jsPdfScript.onload = () => {
                    const autoTableScript = document.createElement('script');
                    autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js';
                    autoTableScript.onload = () => { setPdfLibrariesLoaded(true); };
                    document.body.appendChild(autoTableScript);
                };
                document.body.appendChild(jsPdfScript);
             };
             document.body.appendChild(html2canvasScript);
        };
        loadScripts();
    }, []);

    const basePayoff = useMemo(() => calculatePayoff(debtData, strategy), [debtData, strategy]);
    
    const scenarioPayoff = useMemo(() => {
        return calculatePayoff(debtData, strategy, Number(extraMonthlyPayment) || 0, snowflakePayments, targetDebt);
    }, [debtData, strategy, extraMonthlyPayment, snowflakePayments, targetDebt]);
    
    useEffect(() => {
        const extraPaymentValue = Number(extraMonthlyPayment) || 0;
        if (extraPaymentValue > 0 || snowflakePayments.length > 0 || targetDebt !== 'strategy') {
            setScenarioMode(true);
        } else {
            setScenarioMode(false);
        }
    }, [extraMonthlyPayment, snowflakePayments, targetDebt]);

    const payoffData = scenarioMode ? scenarioPayoff : basePayoff;

    const combinedHistory = useMemo(() => {
        const combined = [];
        const longerHistory = basePayoff.history.length > scenarioPayoff.history.length ? basePayoff.history : scenarioPayoff.history;
        for (let i = 0; i < longerHistory.length; i++) {
            const baseMonth = basePayoff.history[i] || {};
            const scenarioMonth = scenarioPayoff.history[i] || {};
            const entry = { month: i };
            entry['Base Total'] = baseMonth.totalBalance;
            if (scenarioMode) { entry['Scenario Total'] = scenarioMonth.totalBalance; }
            debtData.forEach(debt => {
                const debtName = debt['Debt Name'];
                entry[`${debtName} (Base)`] = baseMonth[debtName];
                if (scenarioMode) { entry[`${debtName} (Scenario)`] = scenarioMonth[debtName]; }
            });
            combined.push(entry);
        }
        return combined;
    }, [basePayoff, scenarioPayoff, scenarioMode, debtData]);

    const addSnowflake = () => {
        const amount = Number(snowflakeAmount);
        const month = Number(snowflakeMonth);
        if (amount > 0 && month > 0) {
            const newSnowflakes = [...snowflakePayments, { month, amount }];
            const newScenarioPayoff = calculatePayoff(debtData, strategy, Number(extraMonthlyPayment) || 0, newSnowflakes, targetDebt);
            setImpactData({
                monthsSaved: basePayoff.months - newScenarioPayoff.months,
                interestSaved: basePayoff.totalInterest - newScenarioPayoff.totalInterest,
                amount
            });
            setShowImpactModal(true);
            setSnowflakePayments(newSnowflakes);
            setSnowflakeAmount('');
            setSnowflakeMonth('');
        }
    };

    const removeSnowflake = (index) => setSnowflakePayments(snowflakePayments.filter((_, i) => i !== index));

    const resetScenario = () => {
        setExtraMonthlyPayment(''); setSnowflakePayments([]); setSnowflakeAmount(''); setSnowflakeMonth(''); setTargetDebt('strategy'); setScenarioMode(false);
    };

    const { totalDebt, totalMinimumPayment } = useMemo(() => {
        if (debtData.length === 0) return { totalDebt: 0, totalMinimumPayment: 0 };
        const totalDebtVal = debtData.reduce((acc, item) => acc + (item.Balance || 0), 0);
        const totalMinPay = debtData.reduce((acc, item) => acc + (item['minimum payment'] || 0), 0);
        return { totalDebt: totalDebtVal, totalMinimumPayment: totalMinPay };
    }, [debtData]);

    const { totalMonthlyBills, billsByCategory } = useMemo(() => {
        if(billData.length === 0) return { totalMonthlyBills: 0, billsByCategory: [] };
        const total = billData.reduce((acc, item) => acc + (item.Amount || 0), 0);
        const categories = {};
        billData.forEach(bill => {
            const category = bill['Category'] || 'Uncategorized';
            if(!categories[category]) categories[category] = 0;
            categories[category] += bill.Amount || 0;
        });
        return { totalMonthlyBills: total, billsByCategory: Object.keys(categories).map(name => ({name, value: categories[name]})) };
    }, [billData]);

    const { totalMonthlyIncome, incomeBySource } = useMemo(() => {
        if(incomeData.length === 0) return { totalMonthlyIncome: 0, incomeBySource: [] };
        const sourcesWithMonthlyValue = incomeData.map(item => {
            let monthlyAmount = item.Amount || 0;
            const frequency = item.Frequency ? item.Frequency.trim().toLowerCase() : '';
            if (frequency === 'weekly') monthlyAmount *= 4.33;
            if (frequency === 'bi-weekly') monthlyAmount *= 2.167;
            return { name: item['Income Source'], value: monthlyAmount };
        });
        const total = sourcesWithMonthlyValue.reduce((acc, item) => acc + item.value, 0);
        return { totalMonthlyIncome: total, incomeBySource: sourcesWithMonthlyValue };
    }, [incomeData]);
    
    const { totalValue, simplifiedAllocation } = useMemo(() => {
        if (!investmentData || investmentData.length === 0) return { totalValue: 0, simplifiedAllocation: [] };
        const total = investmentData.reduce((sum, item) => sum + (item.Value || 0), 0);
        const categories = { Growth: 0, Balanced: 0, Conservative: 0 };
        const growthTypes = ['stock', 'etf', 'crypto', 'growth'];
        const balancedTypes = ['mutual fund', 'index fund', 'reit', 'balanced'];
        investmentData.forEach(item => {
            const type = (item.Type || '').toLowerCase();
            const value = item.Value || 0;
            if (growthTypes.some(t => type.includes(t))) categories.Growth += value;
            else if (balancedTypes.some(t => type.includes(t))) categories.Balanced += value;
            else categories.Conservative += value;
        });
        return { 
            totalValue: total, 
            simplifiedAllocation: Object.keys(categories).map(name => ({ name, value: categories[name] }))
        };
    }, [investmentData]);

    const debtToIncomeRatio = totalMonthlyIncome > 0 ? ((totalMinimumPayment + totalMonthlyBills) / totalMonthlyIncome) * 100 : 0;
    const totalMonthlyObligations = totalMinimumPayment + totalMonthlyBills;

    const generatePDF = async () => {
        if (!pdfLibrariesLoaded) {
            console.error("PDF generation libraries are not loaded yet.");
            return;
        }
        setPdfLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Delay for render
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
    
            // --- Title ---
            doc.setFontSize(22);
            doc.text("Financial Health Report", 105, 20, { align: "center" });
            doc.setFontSize(10);
            doc.text(new Date().toLocaleDateString(), 105, 26, { align: "center" });
    
            let yPos = 40;
    
            // --- Summary Section ---
            doc.setFontSize(16);
            doc.text("Dashboard Summary", 14, yPos);
            yPos += 5;
    
            const summaryData = [
                ["Total Debt", `$${totalDebt.toLocaleString()}`],
                ["Total Monthly Bills", `$${totalMonthlyBills.toLocaleString()}`],
                ["Monthly Debt Payments", `$${totalMinimumPayment.toLocaleString()}`],
                ["Total Monthly Obligations", `$${totalMonthlyObligations.toLocaleString()}`],
            ];
            if (totalMonthlyIncome > 0) {
                 summaryData.push(["Total Monthly Income", `$${totalMonthlyIncome.toLocaleString(undefined, {maximumFractionDigits: 0})}`]);
                 summaryData.push(["Debt-to-Income Ratio", `${debtToIncomeRatio.toFixed(2)}%`]);
            }
            summaryData.push(["Base Payoff Time", `${basePayoff.months} months`]);
    
            if (scenarioMode) {
                summaryData.push(["Scenario Payoff Time", `${payoffData.months} months`]);
                summaryData.push(["Months Saved", `${basePayoff.months - payoffData.months}`]);
                summaryData.push(["Interest Saved", `$${(basePayoff.totalInterest - payoffData.totalInterest).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]);
            }
    
            doc.autoTable({
                startY: yPos,
                head: [['Metric', 'Value']],
                body: summaryData,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] },
            });
    
            yPos = doc.autoTable.previous.finalY + 15;
    
            // --- Payoff Projection Chart Image ---
            const chartElement = document.getElementById('payoff-projection-chart');
            if (chartElement) {
                doc.setFontSize(16);
                doc.text("Payoff Projection", 14, yPos);
                yPos += 8;
                try {
                    const canvas = await window.html2canvas(chartElement, { scale: 2, backgroundColor: '#ffffff' });
                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = doc.getImageProperties(imgData);
                    const pdfWidth = doc.internal.pageSize.getWidth() - 28; // with margin
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    doc.addImage(imgData, 'PNG', 14, yPos, pdfWidth, pdfHeight);
                    yPos += pdfHeight + 15;
                } catch (e) {
                    console.error("Error generating chart image:", e);
                    doc.setFontSize(10);
                    doc.setTextColor(255, 0, 0);
                    doc.text("Could not generate chart image for the report.", 14, yPos);
                    doc.setTextColor(0, 0, 0);
                    yPos += 10;
                }
            }
    
            // --- Debt Details ---
            if (debtData.length > 0) {
                if (yPos > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); yPos = 20; }
                doc.setFontSize(16);
                doc.text("Debt Details", 14, yPos);
                yPos += 8;
                const debtHead = [['Debt Name', 'Balance', 'APR (%)', 'Min. Payment', 'Payoff Date']];
                const debtBody = debtData.map(d => {
                    const payoffDate = new Date();
                    payoffDate.setMonth(payoffDate.getMonth() + (payoffData.debtPayoffDates[d['Debt Name']] || 0));
                    return [
                        d['Debt Name'],
                        `$${d.Balance.toLocaleString()}`,
                        d.APR.toFixed(2),
                        `$${d['minimum payment'].toLocaleString()}`,
                        payoffData.debtPayoffDates[d['Debt Name']] ? payoffDate.toLocaleDateString() : 'N/A'
                    ];
                });
                doc.autoTable({ startY: yPos, head: debtHead, body: debtBody, theme: 'striped' });
                yPos = doc.autoTable.previous.finalY + 15;
            }
    
            // --- Income Details ---
            if (incomeData.length > 0) {
                if (yPos > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); yPos = 20; }
                doc.setFontSize(16);
                doc.text("Income Sources", 14, yPos);
                yPos += 8;
                const incomeHead = [['Source', 'Amount', 'Frequency', 'Est. Monthly']];
                const incomeBody = incomeData.map(i => {
                    let monthlyAmount = i.Amount || 0;
                    const frequency = i.Frequency ? i.Frequency.trim().toLowerCase() : '';
                    if (frequency === 'weekly') monthlyAmount *= 4.33;
                    if (frequency === 'bi-weekly') monthlyAmount *= 2.167;
                    return [i['Income Source'], `$${i.Amount.toLocaleString()}`, i.Frequency, `$${monthlyAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}`];
                });
                doc.autoTable({ startY: yPos, head: incomeHead, body: incomeBody, theme: 'striped' });
                yPos = doc.autoTable.previous.finalY + 15;
            }
    
            // --- Bill Details ---
            if (billData.length > 0) {
                if (yPos > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); yPos = 20; }
                doc.setFontSize(16);
                doc.text("Monthly Bills", 14, yPos);
                yPos += 8;
                const billHead = [['Bill', 'Category', 'Amount']];
                const billBody = billData.map(b => [b['Bill Name'], b['Category'], `$${b.Amount.toLocaleString()}`]);
                doc.autoTable({ startY: yPos, head: billHead, body: billBody, theme: 'striped' });
            }

            // --- Disclaimer ---
            const finalY = doc.autoTable.previous.finalY || yPos;
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("Generated by Smart Steps to Wealth (www.smartstepstowealth.com)", 105, doc.internal.pageSize.getHeight() - 15, { align: 'center', maxWidth: 180 });
            doc.text("Disclaimer: This report is generated for informational purposes only and does not constitute financial advice. Please consult with a qualified financial professional before making any decisions.", 105, doc.internal.pageSize.getHeight() - 10, { align: 'center', maxWidth: 180 });

    
            doc.save('Financial_Report.pdf');
        } catch (e) {
            console.error("Failed to generate PDF:", e);
            setError("An unexpected error occurred while generating the PDF report.");
        } finally {
            setPdfLoading(false);
        }
    };
    
    const generateInvestmentPDF = async () => {
        if (!pdfLibrariesLoaded) {
            console.error("PDF generation libraries are not loaded yet.");
            return;
        }
        setInvestmentPdfLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Short delay for rendering
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
    
            // --- Report Title ---
            doc.setFontSize(22);
            doc.text("Investment Portfolio Report", 105, 20, { align: "center" });
            doc.setFontSize(10);
            doc.text(new Date().toLocaleDateString(), 105, 26, { align: "center" });
            let yPos = 40;
    
            // --- Portfolio Summary ---
            doc.setFontSize(16);
            doc.text("Portfolio Summary", 14, yPos);
            yPos += 5;
            doc.autoTable({
                startY: yPos,
                head: [['Metric', 'Value']],
                body: [
                    ['Total Portfolio Value', `$${totalValue.toLocaleString(undefined, {maximumFractionDigits: 2})}`],
                    ['Assessed Risk Profile', riskProfile ? riskProfile.name : "Not Assessed"]
                ],
                theme: 'grid',
                headStyles: { fillColor: [22, 163, 74] },
            });
            yPos = doc.autoTable.previous.finalY + 15;
    
            // --- Helper to add element as image ---
            const addElementAsImage = async (elementId, title) => {
                const element = document.getElementById(elementId);
                if (element) {
                    if (yPos > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); yPos = 20; }
                    doc.setFontSize(16);
                    doc.text(title, 14, yPos);
                    yPos += 8;
                    const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = doc.getImageProperties(imgData);
                    const pdfWidth = doc.internal.pageSize.getWidth() - 28;
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    if (yPos + pdfHeight > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); yPos = 20; }
                    doc.addImage(imgData, 'PNG', 14, yPos, pdfWidth, pdfHeight);
                    yPos += pdfHeight + 15;
                }
            };

            // --- Add Sections ---
            if (riskProfile) {
                await addElementAsImage('allocation-comparison-section', 'Allocation Comparison');
                
                // Add Asset Category Definitions
                if (yPos > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); yPos = 20; }
                doc.setFontSize(16);
                doc.text("Asset Category Definitions", 14, yPos);
                yPos += 8;
                const definitionsHead = [['Category', 'Description & Examples']];
                const definitionsBody = [
                    ['Growth', 'Higher potential returns, higher risk.\nE.g., Individual Stocks, Crypto, Growth ETFs.'],
                    ['Balanced', 'A mix of growth and stability.\nE.g., Index Funds (S&P 500), Mutual Funds, REITs.'],
                    ['Conservative', 'Lower risk, focus on capital preservation.\nE.g., Bonds, Cash, CDs, Money Market.']
                ];
                doc.autoTable({
                    startY: yPos,
                    head: definitionsHead,
                    body: definitionsBody,
                    theme: 'striped',
                    headStyles: { fillColor: [67, 56, 202] },
                    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 1: { cellWidth: 'auto' } }
                });
                yPos = doc.autoTable.previous.finalY + 15;
            }
    
            // --- Investment Details Table ---
            if (investmentData.length > 0) {
                if (yPos > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); yPos = 20; }
                doc.setFontSize(16);
                doc.text("Investment Details", 14, yPos);
                yPos += 8;
                const head = [['Investment Name', 'Type', 'Value']];
                const body = investmentData.map(i => [
                    i['Investment Name'],
                    i.Type,
                    `$${(i.Value || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                ]);
                doc.autoTable({ startY: yPos, head, body, theme: 'striped' });
                yPos = doc.autoTable.previous.finalY + 15;
            }
    
            // --- Financial Goals Table ---
            if (goals.length > 0) {
                 if (yPos > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); yPos = 20; }
                doc.setFontSize(16);
                doc.text("Financial Goals", 14, yPos);
                yPos += 8;
                const head = [['Goal', 'Target Amount', 'Target Date']];
                const body = goals.map(g => [
                    g.name,
                    `$${g.amount.toLocaleString()}`,
                    new Date(g.date).toLocaleDateString()
                ]);
                doc.autoTable({ startY: yPos, head, body, theme: 'striped' });
            }
    
            // --- Disclaimer ---
            const finalY = doc.autoTable.previous.finalY || yPos;
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("Generated by Smart Steps to Wealth (www.smartstepstowealth.com)", 105, doc.internal.pageSize.getHeight() - 15, { align: 'center', maxWidth: 180 });
            doc.text("Disclaimer: This report is generated for informational purposes only and does not constitute financial advice. Please consult with a qualified financial professional before making any decisions.", 105, doc.internal.pageSize.getHeight() - 10, { align: 'center', maxWidth: 180 });

            doc.save('Investment_Report.pdf');
    
        } catch (e) {
            console.error("Failed to generate PDF:", e);
            setError("An unexpected error occurred while generating the Investment report.");
        } finally {
            setInvestmentPdfLoading(false);
        }
    };


    const viewAmortization = (debtName) => {
        const debtAmortization = payoffData.amortization.find(d => d.id === debtName);
        setAmortizationData(debtAmortization);
        setShowAmortizationModal(true);
    };
    const handleLegendClick = (e) => {
        const debtName = e.dataKey.replace(' (Base)', '').replace(' (Scenario)', '');
        setHiddenDebts(prevHidden => prevHidden.includes(debtName) ? prevHidden.filter(name => name !== debtName) : [...prevHidden, debtName]);
    };
    const renderLegendText = (value, entry) => {
      const debtName = value.replace(' (Base)', '').replace(' (Scenario)', '');
      const isActive = !hiddenDebts.includes(debtName);
      return <span style={{ color: isActive ? '#333' : '#AAA', cursor: 'pointer' }}>{value}</span>;
    };

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-gray-800">
            {showImpactModal && <ImpactModal impactData={impactData} setShowImpactModal={setShowImpactModal} />}
            {showAmortizationModal && <AmortizationModal amortizationData={amortizationData} setShowAmortizationModal={setShowAmortizationModal} />}
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <header className="text-center mb-8">
                    <h1 className="text-5xl font-extrabold text-gray-800">
                        <span className="bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent">
                             {isDataLoaded ? 'Financial Dashboard' : 'Smart Steps To Wealth'}
                        </span>
                    </h1>
                    <p className="text-lg text-gray-600 mt-2">Your complete financial picture, simplified.</p>
                </header>

                <div className="max-w-3xl mx-auto bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-xl border border-gray-200/80 mb-8">
                    {!isDataLoaded ? (
                        <>
                           <h2 className="text-2xl font-bold text-center text-gray-700 mb-6">Get Started</h2>
                            <div className="space-y-4">
                                <div className="relative">
                                    <label className="text-sm font-medium text-gray-700">Smart Steps Link</label>
                                    <Link className="absolute left-3 top-10 h-5 w-5 text-gray-400" />
                                    <input type="text" value={smartStepsUrl} onChange={(e) => setSmartStepsUrl(e.target.value)} placeholder="Paste your single link from Google Sheets here" className="mt-1 w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 mt-6">
                                <button onClick={() => processSheetData()} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:scale-105 hover:shadow-lg transition-all duration-300 disabled:bg-gray-400 disabled:from-gray-400 disabled:to-gray-500 disabled:scale-100 flex items-center justify-center">
                                    {loading && <Loader className="animate-spin h-5 w-5 mr-2" />}
                                    {loading ? 'Loading...' : 'Load Data'}
                                </button>
                                <button onClick={clearAllData} className="p-3 text-gray-500 hover:bg-gray-100 rounded-lg" title="Clear All Data & Links">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center">
                             <div className="flex justify-center items-center gap-2 rounded-lg bg-slate-100 p-1 mb-4 max-w-sm mx-auto">
                                <button onClick={() => setCurrentView('debt')} className={`w-full px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${currentView === 'debt' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-slate-200'}`}>Debt Dashboard</button>
                                <button onClick={() => setCurrentView('investment')} className={`w-full px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${currentView === 'investment' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-600 hover:bg-slate-200'}`}>Investment Portfolio</button>
                            </div>
                            <p className="text-lg font-medium text-green-600">Dashboard data loaded successfully!</p>
                            <div className="mt-4 flex justify-center items-center gap-6">
                                 <button onClick={() => processSheetData()} disabled={loading} className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-2 disabled:text-gray-400 disabled:cursor-not-allowed">
                                    {loading ? <Loader className="animate-spin h-4 w-4" /> : <RefreshCw size={14} />}
                                    {loading ? 'Reloading...' : 'Reload Data'}
                                </button>
                                <button onClick={() => setIsDataLoaded(false)} className="text-sm font-semibold text-gray-600 hover:underline flex items-center gap-2">
                                    <Edit size={14} /> Change Sheet Link
                                </button>
                                <button onClick={clearAllData} className="text-sm font-semibold text-red-600 hover:underline flex items-center gap-2">
                                    <Trash2 size={14} /> Clear All Data
                                </button>
                            </div>
                        </div>
                    )}
                    {error && <div className="mt-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md flex items-center"><AlertCircle className="h-5 w-5 mr-3" /><span>{error}</span></div>}
                </div>
                
                {showInstructions && !isDataLoaded && <Instructions />}

                {isDataLoaded && currentView === 'debt' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                           <StatCard icon={<DollarSign className="h-6 w-6 text-white"/>} title="Total Debt" value={`$${totalDebt.toLocaleString()}`} color="bg-red-500" />
                           <StatCard icon={<ClipboardList className="h-6 w-6 text-white"/>} title="Monthly Bills" value={`$${totalMonthlyBills.toLocaleString()}`} color="bg-yellow-500" />
                           <StatCard icon={<TrendingUp className="h-6 w-6 text-white"/>} title="Total Monthly Obligations" value={`$${totalMonthlyObligations.toLocaleString()}`} color="bg-purple-500"/>
                           <StatCard icon={<Calendar className="h-6 w-6 text-white"/>} title="Debt-Free In" value={`${payoffData.months} months`} baseValue={`${basePayoff.months} months`} color="bg-blue-500" />
                        </div>

                        {incomeData.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <StatCard icon={<Briefcase className="h-6 w-6 text-white"/>} title="Total Monthly Income" value={`$${totalMonthlyIncome.toLocaleString(undefined, {maximumFractionDigits: 0})}`} color="bg-green-500" />
                                <StatCard 
                                    icon={<Percent className="h-6 w-6 text-white"/>} 
                                    title="Debt-to-Income Ratio" 
                                    value={`${debtToIncomeRatio.toFixed(2)}%`} 
                                    color={debtToIncomeRatio > 40 ? 'bg-red-500' : 'bg-green-500'}
                                    tooltipText={dtiTooltipText}
                                />
                                <div id="income-pie-chart" className="md:col-span-1 bg-white p-4 rounded-lg shadow-md">
                                    <h3 className="text-lg font-bold text-gray-800 mb-2">Income Sources</h3>
                                    <ResponsiveContainer width="100%" height={150}>
                                        <PieChart>
                                            <Pie 
                                                data={incomeBySource} 
                                                dataKey="value" 
                                                nameKey="name" 
                                                cx="50%" 
                                                cy="50%" 
                                                outerRadius={40} 
                                                fill="#8884d8"
                                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                            >
                                                {incomeBySource.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `$${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`} />
                                            <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                            <div className="flex flex-col md:flex-row justify-between md:items-center mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">Debt Payoff Plan</h2>
                                    <p className="text-sm text-gray-500">Select a strategy and model your future.</p>
                                </div>
                                <button onClick={generatePDF} disabled={!pdfLibrariesLoaded || pdfLoading} className="mt-4 md:mt-0 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                    {pdfLoading ? <Loader className="animate-spin h-4 w-4" /> : <Download size={16}/>}
                                    {pdfLoading ? 'Generating...' : 'Download Report'}
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-bold text-lg">Base Strategy</h3>
                                        <Tooltip text={ <div className="text-left"> <p className="font-bold mb-1">Debt Snowball:</p> <p className="mb-2">Focuses all extra payments on the smallest balance first. After a debt is paid off, its entire payment amount is 'snowballed' onto the next smallest debt. This method is great for building motivation with quick wins.</p> <p className="font-bold mb-1">Debt Avalanche:</p> <p>Focuses all extra payments on the debt with the highest APR. This method is the most financially efficient, saving you the most money in interest over the long term.</p> </div> }>
                                            <Info size={16} className="text-gray-400 cursor-pointer" />
                                        </Tooltip>
                                    </div>
                                    <div className="space-y-3">
                                        <StrategyCard title="Debt Snowball" description="Pay off smallest debts first for quick wins." value="snowball" icon={<Zap className="text-yellow-500" />} selected={strategy === 'snowball'} setStrategy={setStrategy} />
                                        <StrategyCard title="Debt Avalanche" description="Pay off highest interest debts first to save money." value="avalanche" icon={<TrendingDown className="text-red-500" />} selected={strategy === 'avalanche'} setStrategy={setStrategy} />
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg text-indigo-800">What-If Scenario</h3>
                                            <Tooltip text="Use these tools to see how extra payments can accelerate your payoff. When you pay off one debt, the entire payment amount (minimum + extra) automatically 'snowballs' to the next debt in your plan, speeding everything up!">
                                                <Info size={16} className="text-gray-400 cursor-pointer" />
                                            </Tooltip>
                                        </div>
                                        {scenarioMode && <button onClick={resetScenario} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><RefreshCw size={12}/> Reset Scenario</button>}
                                    </div>
                                    <div className="space-y-4">
                                        <div className="bg-white/60 p-3 rounded-lg shadow-inner">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Recurring Extra Payments</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                                <div>
                                                    <label htmlFor="extra-payment" className="block text-xs font-medium text-gray-600">Amount</label>
                                                    <div className="relative mt-1">
                                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
                                                        <input type="number" id="extra-payment" value={extraMonthlyPayment} onChange={e => setExtraMonthlyPayment(e.target.value)} placeholder="100" className="w-full pl-8 text-sm border-gray-300 rounded-md shadow-sm"/>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label htmlFor="target-debt" className="block text-xs font-medium text-gray-600">Apply To</label>
                                                    <select id="target-debt" value={targetDebt} onChange={e => setTargetDebt(e.target.value)} className="mt-1 block w-full pl-3 pr-8 py-2 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md">
                                                        <option value="strategy">Follow Strategy</option>
                                                        {debtData.map((debt, index) => ( <option key={`${debt['Debt Name']}-${index}`} value={debt['Debt Name']}> {debt['Debt Name']} </option> ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white/60 p-3 rounded-lg shadow-inner">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-2">One-Time "Snowflake" Payments</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/><input type="number" value={snowflakeMonth} onChange={e => setSnowflakeMonth(e.target.value)} placeholder="Month #" className="w-full pl-8 text-sm border-gray-300 rounded-md"/></div>
                                                <div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/><input type="number" value={snowflakeAmount} onChange={e => setSnowflakeAmount(e.target.value)} placeholder="Amount" className="w-full pl-8 text-sm border-gray-300 rounded-md"/></div>
                                                <button onClick={addSnowflake} className="sm:col-span-1 bg-indigo-500 text-white font-bold rounded-md hover:bg-indigo-600 text-sm py-2">Add</button>
                                            </div>
                                        </div>
                                    </div>
                                    {snowflakePayments.length > 0 && <ul className="mt-3 space-y-1 max-h-24 overflow-y-auto"> {snowflakePayments.map((p, i) => ( <li key={i} className="flex justify-between items-center bg-white/60 p-1.5 rounded-md text-sm"> <span className="text-gray-700">Extra ${p.amount.toLocaleString()} in month {p.month}</span> <button onClick={() => removeSnowflake(i)} className="text-red-500 hover:text-red-700"><X size={16}/></button> </li> ))} </ul> }
                                </div>
                            </div>
                        </div>

                        <div id="payoff-projection-chart" className="bg-white p-6 rounded-lg shadow-md mb-8">
                           <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-bold">Debt Payoff Projection</h3>
                                     <Tooltip text="This chart projects your debt balance over time. Use the view toggle to see the total balance or individual debts. In the 'Individual' view, click on debts in the legend at the bottom to show or hide them.">
                                        <Info size={16} className="text-gray-400 cursor-pointer" />
                                    </Tooltip>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
                                    <button onClick={() => setChartView('total')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${chartView === 'total' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>Total Balance</button>
                                    <button onClick={() => setChartView('individual')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${chartView === 'individual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>Individual Debts</button>
                                </div>
                           </div>
                           <ResponsiveContainer width="100%" height={400}>
                               <LineChart data={combinedHistory}>
                                   <CartesianGrid strokeDasharray="3 3" />
                                   <XAxis dataKey="month" label={{ value: 'Months', position: 'insideBottom', offset: -5 }}/>
                                   <YAxis tickFormatter={(value) => `$${(value/1000)}k`} />
                                   <RechartsTooltip formatter={(value, name) => [`$${value.toLocaleString()}`, name.replace(' (Base)', '').replace(' (Scenario)', '')]} />
                                   <Legend onClick={handleLegendClick} formatter={renderLegendText} />
                                   {chartView === 'total' && ( <> <Line type="monotone" dataKey="Base Total" name="Base Total" stroke="#8884d8" strokeWidth={2} dot={false}/> {scenarioMode && <Line type="monotone" dataKey="Scenario Total" name="Scenario Total" stroke="#22c55e" strokeWidth={3} dot={false} />} </> )}
                                   {chartView === 'individual' && debtData.map((debt, index) => { const debtName = debt['Debt Name']; const isHidden = hiddenDebts.includes(debtName); return ( <React.Fragment key={debtName}> <Line type="monotone" dataKey={`${debtName} (Base)`} name={`${debtName} (Base)`} stroke={COLORS[index % COLORS.length]} strokeWidth={2} strokeDasharray="3 3" dot={false} hide={isHidden} /> {scenarioMode && ( <Line type="monotone" dataKey={`${debtName} (Scenario)`} name={`${debtName} (Scenario)`} stroke={COLORS[index % COLORS.length]} strokeWidth={3} dot={false} hide={isHidden} /> )} </React.Fragment> ); })}
                               </LineChart>
                           </ResponsiveContainer>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h3 className="text-xl font-bold mb-4">Debt Details & Amortization</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm"><thead className="bg-gray-100 text-xs text-gray-700 uppercase"><tr><th className="p-3">Debt Name</th><th className="p-3 text-right">Balance</th><th className="p-3 text-right">APR</th><th className="p-3 text-right">Payoff Date</th><th className="p-3 text-center">Actions</th></tr></thead><tbody>{debtData.map((debt, index) => { const payoffDate = new Date(); payoffDate.setMonth(payoffDate.getMonth() + (payoffData.debtPayoffDates[debt['Debt Name']] || 0)); return ( <tr key={index} className="border-b hover:bg-gray-50"><td className="p-3 font-medium">{debt['Debt Name']}</td><td className="p-3 text-right">${(debt.Balance || 0).toLocaleString()}</td><td className="p-3 text-right">{(debt.APR || 0).toFixed(2)}%</td><td className="p-3 text-right">{payoffData.debtPayoffDates[debt['Debt Name']] ? payoffDate.toLocaleDateString() : 'N/A'}</td><td className="p-3 text-center"><button onClick={() => viewAmortization(debt['Debt Name'])} className="text-blue-600 hover:text-blue-800 text-xs font-semibold">VIEW SCHEDULE</button></td></tr> )})}</tbody></table>
                                </div>
                            </div>
                            {billData.length > 0 && <div id="bills-pie-chart" className="bg-white p-6 rounded-lg shadow-md"> <h3 className="text-xl font-bold mb-4 flex items-center"><PieChartIcon className="h-5 w-5 mr-2 text-green-500"/>Monthly Bills by Category</h3> <ResponsiveContainer width="100%" height={300}> <PieChart> <Pie data={billsByCategory} cx="40%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}> {billsByCategory.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))} </Pie> <RechartsTooltip formatter={(value) => `$${value.toLocaleString()}`} /> <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ right: 0, paddingLeft: '20px' }}/> </PieChart> </ResponsiveContainer> </div> }
                        </div>
                        {billData.length > 0 && ( <div className="bg-white p-6 rounded-lg shadow-md mb-8"> <h3 className="text-xl font-bold mb-4">Bill Details</h3> <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-100 text-xs text-gray-700 uppercase"><tr><th className="p-3">Bill Name</th><th className="p-3">Category</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{billData.map((bill, index) => ( <tr key={index} className="border-b hover:bg-gray-50"><td className="p-3 font-medium">{bill['Bill Name']}</td><td className="p-3">{bill['Category']}</td><td className="p-3 text-right">${(bill.Amount || 0).toLocaleString()}</td></tr>))}</tbody></table></div></div> )}
                    </>
                )}

                {isDataLoaded && currentView === 'investment' && (
                    <InvestmentPortfolioView 
                        data={investmentData}
                        riskProfile={riskProfile}
                        setRiskProfile={setRiskProfile}
                        goals={goals}
                        setGoals={setGoals}
                        generateInvestmentPDF={generateInvestmentPDF}
                        investmentPdfLoading={investmentPdfLoading}
                        pdfLibrariesLoaded={pdfLibrariesLoaded}
                        totalValue={totalValue}
                        simplifiedAllocation={simplifiedAllocation}
                        financialSummary={{ totalMonthlyIncome, totalMonthlyBills, totalMinimumPayment }}
                    />
                )}
            </div>
            <Footer />
        </div>
    );
};

export default App;
