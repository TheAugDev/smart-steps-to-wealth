import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Sector } from 'recharts';
import { Sheet, DollarSign, Percent, Info, TrendingUp, AlertCircle, Loader, ExternalLink, PieChart as PieChartIcon, ChevronsRight, Award, X, Calendar, Repeat, Download, FileText, RefreshCw, ClipboardList, CheckCircle2, Zap, TrendingDown, Eye, Trash2, Briefcase, Edit, Landmark, Target, PlusCircle, Trash, Shield, BarChart2, Activity, AlertTriangle, GitCommit, Link, Sparkles, ArrowLeftRight, Menu, Home as HomeIcon, LayoutDashboard, BookOpen, Handshake, UploadCloud, ArrowUpCircle, ArrowDownCircle, Banknote, Filter as FilterIcon, Printer, Clock, Mail, Github, MessageSquare, Youtube } from 'lucide-react';

// --- Colors for Charts ---
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff4d4d', '#4BC0C0', '#9966FF', '#FF6384', '#36A2EB'];
const ALLOCATION_COLORS = { 'Growth': '#22c55e', 'Balanced': '#facc15', 'Conservative': '#3b82f6' };


// --- Calculation Engine ---
const calculatePayoff = (debts, strategy, extraPayment = 0, snowflakePayments = [], targetDebt = 'strategy') => {
    if (!debts || debts.length === 0) return { history: [], months: 0, totalInterest: 0, amortization: [], debtPayoffDates: {} };

    let currentDebts = JSON.parse(JSON.stringify(debts)).map(d => ({...d, id: d['Debt Name'], interestPaid: 0, amortization: [], originalMinPayment: d['minimum payment'] }));
    let history = [];
    let month = 0;
    let totalInterestPaid = 0;
    let debtPayoffDates = {};
    const totalMinimums = currentDebts.reduce((sum, d) => sum + d.originalMinPayment, 0);

    // Initial state at month 0
    const initialHistoryEntry = { month: 0, totalBalance: currentDebts.reduce((sum, d) => sum + d.Balance, 0) };
    currentDebts.forEach(debt => { initialHistoryEntry[debt.id] = debt.Balance; });
    history.push(initialHistoryEntry);

    while (currentDebts.some(d => d.Balance > 0)) {
        month++;
        let monthlyPaymentPool = totalMinimums + extraPayment;
        
        const snowflake = snowflakePayments.find(s => s.month === month);
        if (snowflake) { monthlyPaymentPool += snowflake.amount; }

        // 1. Accrue Interest
        currentDebts.forEach(debt => {
            if (debt.Balance > 0) {
                const monthlyInterest = (debt.Balance * (debt.APR / 100)) / 12;
                debt.Balance += monthlyInterest;
                totalInterestPaid += monthlyInterest;
                debt.interestPaid += monthlyInterest;
            }
        });
        
        // 2. Apply payments
        let paymentOrder;
        if (strategy === 'avalanche') {
            paymentOrder = [...currentDebts].sort((a, b) => b.APR - a.APR || a.Balance - b.Balance);
        } else { // snowball
            paymentOrder = [...currentDebts].sort((a, b) => a.Balance - b.Balance || b.APR - a.APR);
        }

        let focusedPaymentOrder = paymentOrder;
        if (targetDebt !== 'strategy' && currentDebts.find(d => d.id === targetDebt && d.Balance > 0)) {
            const target = currentDebts.find(d => d.id === targetDebt);
            const others = paymentOrder.filter(d => d.id !== targetDebt);
            focusedPaymentOrder = [target, ...others];
        }

        // Apply minimum payments first
        for (const debt of currentDebts) {
            if (debt.Balance > 0 && monthlyPaymentPool > 0) {
                const payment = Math.min(debt.Balance, debt.originalMinPayment);
                const interestPart = (debt.Balance * (debt.APR / 100)) / 12;
                const principalPart = payment - interestPart;

                debt.Balance -= payment;
                monthlyPaymentPool -= payment;
                
                debt.amortization.push({ month, payment, interest: interestPart, principal: principalPart, balance: debt.Balance });
            }
        }

        // Apply extra payments (snowball/avalanche)
        for (const debt of focusedPaymentOrder) {
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

const Instructions = () => ( 
    <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 rounded-3xl mb-8 shadow-2xl shadow-slate-200/50 dark:shadow-slate-900/50 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-to-tr from-purple-400/20 to-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center mb-4 sm:mb-0">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl mr-4 shadow-lg shadow-blue-500/20">
                        <Info className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Getting Started Guide</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Connect your Google Sheet in a few simple steps.</p>
                    </div>
                </div>
                <a 
                    href="#" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="group bg-red-600 hover:bg-red-700 text-white pl-3 pr-4 py-2 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center space-x-2"
                    title="Coming Soon: Video Tutorial"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    <span>Watch Tutorial</span>
                    <span className="bg-yellow-300 text-yellow-900 px-2 py-0.5 rounded-full text-xs font-bold ml-2">SOON</span>
                </a>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Steps */}
                <div className="lg:col-span-2 space-y-3">
                    <h4 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4">Setup Process:</h4>
                    {[
                        {
                            number: 1,
                            title: "Copy the Google Sheets Template",
                            content: "Start by making a copy of our official template. This sheet is pre-formatted to work perfectly with the app.",
                            link: "https://docs.google.com/spreadsheets/d/1hD7oQM8cgB9EBhs1wHuBgaSFOwLH1a_TGg4jU84vfFw/edit?usp=sharing",
                            icon: FileText
                        },
                        {
                            number: 2,
                            title: "Input Your Financial Data",
                            content: "Fill in the 'Debts', 'Income', 'Bills', and 'Investments' tabs with your personal financial information. The sample data can be cleared.",
                            icon: Edit
                        },
                        {
                            number: 3,
                            title: "Deploy the Apps Script",
                            content: "In your sheet, go to Extensions > Apps Script. Click 'Deploy' > 'New deployment'. This creates a secure web app link.",
                            icon: UploadCloud
                        },
                        {
                            number: 4,
                            title: "Configure & Authorize",
                            content: "Set 'Who has access' to 'Anyone' (but only you will have the link). Authorize the script, clicking 'Advanced' and 'Allow' when prompted.",
                            icon: CheckCircle2
                        },
                        {
                            number: 5,
                            title: "Connect to the Dashboard",
                            content: "Copy the final 'Web app URL' and paste it into the input field at the top of this page. Your dashboard will instantly come to life.",
                            icon: Link
                        }
                    ].map((step, index, arr) => (
                        <div key={step.number} className="flex items-start space-x-4 group">
                            <div className="flex flex-col items-center">
                                <div className="flex-shrink-0 w-10 h-10 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 group-hover:border-blue-500 dark:group-hover:border-blue-500 text-slate-500 dark:text-slate-400 group-hover:text-blue-500 rounded-full flex items-center justify-center text-lg font-bold transition-colors duration-300">
                                    <step.icon className="h-5 w-5" />
                                </div>
                                {index < arr.length - 1 && <div className="w-0.5 h-16 bg-slate-200 dark:bg-slate-700 group-hover:bg-blue-300 dark:group-hover:bg-blue-800 transition-colors duration-300"></div>}
                            </div>
                            <div className="flex-1 pt-1">
                                <h5 className="font-bold text-slate-800 dark:text-slate-100">{step.title}</h5>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.content}</p>
                                {step.link && (
                                    <a href={step.link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold mt-2 inline-flex items-center">
                                        Open Template <ExternalLink className="h-3 w-3 ml-1.5" />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Column: Info Cards */}
                <div className="lg:col-span-1 space-y-6">
                    {/* What you'll get */}
                    <div className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-sm p-5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center mb-3">
                            <Zap className="h-5 w-5 mr-2 text-green-500" />
                            Features Unlocked
                        </h4>
                        <ul className="text-sm space-y-2 text-slate-600 dark:text-slate-400">
                            {[
                                "Debt Payoff Visualizations",
                                "AI Financial Coach",
                                "Cashflow Analysis",
                                "Strategy Comparison",
                                "Investment Planning",
                                "Real-time Updates"
                            ].map(item => (
                                <li key={item} className="flex items-center">
                                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Privacy */}
                    <div className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-sm p-5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center mb-3">
                            <Shield className="h-5 w-5 mr-2 text-blue-500" />
                            Your Privacy is Paramount
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            Your financial data remains securely in your Google Sheet. This app only reads the data to visualize it; we never store, save, or see your personal information.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div> 
);
const StatCard = ({ icon, title, value, baseValue, color, tooltipText, description }) => ( <div className="bg-white p-4 rounded-lg shadow-md transition-transform hover:scale-105 hover:-translate-y-1"> <div className="flex items-center"> <div className={`p-3 rounded-full mr-4 ${color}`}>{icon}</div> <div> <div className="flex items-center"> <p className="text-sm text-gray-500">{title}</p> {tooltipText && ( <Tooltip text={tooltipText}> <Info size={14} className="ml-1.5 text-gray-400 hover:text-gray-600 cursor-pointer" /> </Tooltip> )} </div> <p className="text-2xl font-bold text-gray-800">{value}</p> </div> </div> {baseValue && value !== baseValue && ( <div className="mt-2 text-sm text-center"> <span className="text-gray-500 line-through">{baseValue}</span> <ChevronsRight className="inline h-4 w-4 mx-1 text-green-500" /> <span className="font-bold text-green-600">{value}</span> </div> )} {description && <p className="text-xs text-gray-500 mt-2">{description}</p>}</div> );
const ImpactModal = ({ impactData, setShowImpactModal }) => ( <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full text-center relative"> <button onClick={() => setShowImpactModal(false)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"><X /></button> <Award className="h-16 w-16 text-yellow-400 mx-auto mb-4" /> <h2 className="text-2xl font-bold text-gray-800 mb-2">Amazing!</h2> <p className="text-lg text-gray-600">That <span className="font-bold text-green-600">${impactData.amount.toLocaleString()}</span> payment made a huge difference!</p> <div className="mt-6 space-y-3"> <div className="bg-green-50 p-3 rounded-lg"> <p className="text-sm text-green-800">You'll be debt-free</p> <p className="text-xl font-bold text-green-600">{impactData.monthsSaved} months sooner!</p> </div> <div className="bg-blue-50 p-3 rounded-lg"> <p className="text-sm text-blue-800">You'll save an extra</p> <p className="text-xl font-bold text-blue-600">${impactData.interestSaved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in interest!</p> </div> </div> </div> </div> );
const AmortizationModal = ({ amortizationData, setShowAmortizationModal }) => ( <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl p-6 max-w-2xl w-full text-center relative"> <button onClick={() => setShowAmortizationModal(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><X /></button> <h2 className="text-2xl font-bold text-gray-800 mb-4">Amortization Schedule for {amortizationData?.id}</h2> <div className="overflow-y-auto h-96"><table className="w-full text-sm text-left"><thead className="bg-gray-100 text-xs text-gray-700 uppercase sticky top-0"><tr><th className="p-2">Month</th><th className="p-2 text-right">Payment</th><th className="p-2 text-right">Principal</th><th className="p-2 text-right">Interest</th><th className="p-2 text-right">Remaining Balance</th></tr></thead><tbody>{amortizationData?.amortization.map(row => ( <tr key={row.month} className="border-b"><td className="p-2">{row.month}</td><td className="p-2 text-right">${row.payment.toFixed(2)}</td><td className="p-2 text-right">${row.principal.toFixed(2)}</td><td className="p-2 text-right">${row.interest.toFixed(2)}</td><td className="p-2 text-right">${row.balance.toFixed(2)}</td></tr>))}</tbody></table></div></div></div> );
const StrategyCard = ({ title, description, value, icon, selected, setStrategy }) => ( <div onClick={() => setStrategy(value)} className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}> <div className="flex justify-between items-center"> <div className="flex items-center"> {icon} <h4 className="font-bold ml-2">{title}</h4> </div> {selected && <CheckCircle2 className="text-blue-500" />} </div> <p className="text-sm text-gray-600 mt-1">{description}</p> </div> );
const dtiTooltipText = ( <div className="text-left space-y-2"> <p>Your Debt-to-Income (DTI) ratio is all your monthly debt payments divided by your gross monthly income. Lenders use it to measure your ability to manage payments.</p> <div> <p className="font-bold">General Guidelines:</p> <ul className="list-disc list-inside text-xs"> <li><span className="font-semibold text-green-400">36% or less:</span> Optimal</li> <li><span className="font-semibold text-yellow-400">37% to 42%:</span> Manageable</li> <li><span className="font-semibold text-orange-400">43% to 49%:</span> Cause for concern</li> <li><span className="font-semibold text-red-400">50% or more:</span> Dangerous</li> </ul> </div> </div> );

// --- AI Response Parser ---
const GeminiResponseParser = ({ text }) => {
    const formattedContent = useMemo(() => {
        if (!text) return null;

        const lines = text.split('\n').filter(line => line.trim() !== '');
        const elements = [];
        let inList = false;
        let listItems = [];

        const flushList = () => {
            if (listItems.length > 0) {
                elements.push(<ul key={`ul-${elements.length}`} className="space-y-2 list-inside text-gray-700 my-3">{listItems}</ul>);
                listItems = [];
            }
            inList = false;
        };

        lines.forEach((line, index) => {
            line = line.trim();

            // Handle headings (e.g., **My Heading**)
            if (line.startsWith('**') && line.endsWith('**')) {
                flushList();
                elements.push(
                    <h4 key={index} className="text-lg font-bold text-gray-800 mt-4 mb-2 flex items-center gap-2">
                        <ChevronsRight className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                        {line.substring(2, line.length - 2)}
                    </h4>
                );
                return;
            }

            // Handle bullet points (e.g., * My bullet or - My bullet)
            if (line.startsWith('* ') || line.startsWith('- ')) {
                if (!inList) inList = true;
                listItems.push(
                    <li key={index} className="flex items-start gap-3">
                        <div className="mt-1"><CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" /></div>
                        <span>{line.substring(2)}</span>
                    </li>
                );
                return;
            }

            // If we were in a list and the current line is not a list item, flush the list
            flushList();

            // Handle bold text inside a paragraph
            const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
            
            // Regular paragraph
            elements.push(<p key={index} className="mb-3 text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine }}></p>);
        });

        flushList(); // Flush any remaining list items at the end
        return elements;
    }, [text]);

    return <div className="prose prose-indigo max-w-none">{formattedContent}</div>;
};


// --- AI-Powered Modals ---
const SpendingInsightsModal = ({ insights, isLoading, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl p-6 max-w-2xl w-full relative">
            <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><X /></button>
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-100 rounded-full"><Sparkles className="h-6 w-6 text-yellow-500" /></div>
                <h2 className="text-2xl font-bold text-gray-800">AI Spending Insights</h2>
            </div>
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <Loader className="animate-spin h-12 w-12 text-indigo-600" />
                    <p className="mt-4 text-gray-600">Analyzing your spending patterns...</p>
                </div>
            ) : (
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                    <GeminiResponseParser text={insights} />
                </div>
            )}
        </div>
    </div>
);

const DebtCoachModal = ({ plan, isLoading, onClose, healthStatus, onPrint }) => {
    const statusConfig = {
        'Excellent': {
            icon: <CheckCircle2 className="h-6 w-6 text-green-700" />,
            style: 'bg-green-100 text-green-800 border-green-300',
            text: 'Excellent Financial Health'
        },
        'Good': {
            icon: <TrendingUp className="h-6 w-6 text-blue-700" />,
            style: 'bg-blue-100 text-blue-800 border-blue-300',
            text: 'Good Financial Health'
        },
        'Needs Improvement': {
            icon: <AlertTriangle className="h-6 w-6 text-yellow-700" />,
            style: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            text: 'Financial Health Needs Improvement'
        },
        'High Alert': {
            icon: <AlertCircle className="h-6 w-6 text-red-700" />,
            style: 'bg-red-100 text-red-800 border-red-300',
            text: 'Financial Health Status: High Alert'
        },
        'default': {
            icon: <Info className="h-6 w-6 text-gray-700" />,
            style: 'bg-gray-100 text-gray-800 border-gray-300',
            text: 'Financial Health Status'
        }
    };

    const currentStatus = statusConfig[healthStatus] || statusConfig.default;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 max-w-3xl w-full relative">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-full"><Sparkles className="h-6 w-6 text-purple-500" /></div>
                        <h2 className="text-2xl font-bold text-gray-800">AI Debt Coach</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onPrint} className="p-2 text-gray-500 hover:bg-gray-100 rounded-md" title="Print Report">
                            <Printer size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"><X /></button>
                    </div>
                </div>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <Loader className="animate-spin h-12 w-12 text-indigo-600" />
                        <p className="mt-4 text-gray-600">Preparing your personalized debt plan...</p>
                    </div>
                ) : (
                    <div className="max-h-[70vh] overflow-y-auto pr-2">
                        {healthStatus && (
                            <div className={`p-4 rounded-lg border flex items-center gap-4 mb-4 ${currentStatus.style}`}>
                                {currentStatus.icon}
                                <p className="font-semibold">{currentStatus.text}</p>
                            </div>
                        )}
                        <GeminiResponseParser text={plan} />
                    </div>
                )}
            </div>
        </div>
    );
};


const FilterDropdown = ({ columnKey, title, data, filters, onFilterChange, predefinedItems }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selected, setSelected] = useState(filters[columnKey] || new Set());

    const uniqueItems = useMemo(() => {
        if (predefinedItems) return predefinedItems;
        const items = new Set(data.map(item => item[columnKey] || 'Uncategorized'));
        return Array.from(items).sort();
    }, [data, columnKey, predefinedItems]);

    const filteredItems = useMemo(() => {
        return uniqueItems.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [uniqueItems, searchTerm]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelected(new Set(uniqueItems));
        } else {
            setSelected(new Set());
        }
    };

    const handleSelectItem = (item, checked) => {
        const newSelected = new Set(selected);
        if (checked) {
            newSelected.add(item);
        } else {
            newSelected.delete(item);
        }
        setSelected(newSelected);
    };

    const applyFilter = () => {
        onFilterChange(columnKey, selected);
        setIsOpen(false);
    };
    
    const clearFilter = () => {
        const newSelected = new Set();
        setSelected(newSelected);
        onFilterChange(columnKey, newSelected);
        setIsOpen(false);
    };

    useEffect(() => {
        setSelected(filters[columnKey] || new Set());
    }, [filters, columnKey, isOpen]);

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-1 font-semibold group">
                {title}
                <FilterIcon className={`h-4 w-4 transition-colors text-gray-400 group-hover:text-gray-700 ${(filters[columnKey] && filters[columnKey].size > 0) ? 'text-blue-600' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-2 w-64 bg-white rounded-md shadow-lg border left-0">
                    { !predefinedItems && 
                        <div className="p-2">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full px-2 py-1 border rounded-md text-sm"
                            />
                        </div>
                    }
                    <div className="p-2 border-t max-h-60 overflow-y-auto">
                        <label className="flex items-center space-x-2 px-2 py-1 text-sm hover:bg-gray-100 rounded">
                            <input
                                type="checkbox"
                                checked={selected.size === uniqueItems.length && uniqueItems.length > 0}
                                onChange={handleSelectAll}
                            />
                            <span>(Select All)</span>
                        </label>
                        {filteredItems.map(item => (
                            <label key={item} className="flex items-center space-x-2 px-2 py-1 text-sm hover:bg-gray-100 rounded">
                                <input
                                    type="checkbox"
                                    checked={selected.has(item)}
                                    onChange={e => handleSelectItem(item, e.target.checked)}
                                />
                                <span className="capitalize">{item}</span>
                            </label>
                        ))}
                    </div>
                    <div className="p-2 flex justify-end gap-2 border-t bg-gray-50">
                        <button onClick={clearFilter} className="px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300">Clear</button>
                        <button onClick={applyFilter} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Apply</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const CashflowView = ({ incomeData, billData, debtData, transactions, setTransactions, cashflowSource, setCashflowSource }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [newTx, setNewTx] = useState({ date: new Date().toISOString().slice(0,10), description: '', amount: '', category: 'Misc', type: 'expense' });
    const [showCsvMapModal, setShowCsvMapModal] = useState(false);
    const [csvDataForMapping, setCsvDataForMapping] = useState(null);
    const [dateFilter, setDateFilter] = useState({ type: 'thisMonth', start: '', end: '' });
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [mainTableFilters, setMainTableFilters] = useState({});
    const [overviewTableFilters, setOverviewTableFilters] = useState({});
    
    // AI Insights State
    const [showInsightsModal, setShowInsightsModal] = useState(false);
    const [insights, setInsights] = useState('');
    const [insightsLoading, setInsightsLoading] = useState(false);

    const handleMainTableFilterChange = (columnKey, selectedItems) => {
        setMainTableFilters(prev => ({ ...prev, [columnKey]: selectedItems }));
    };

    const handleOverviewTableFilterChange = (columnKey, selectedItems) => {
        setOverviewTableFilters(prev => ({ ...prev, [columnKey]: selectedItems }));
    };

    const handleAddTransaction = (e) => {
        e.preventDefault();
        if (newTx.description && newTx.amount) {
            setTransactions(prev => [...prev, { ...newTx, amount: parseFloat(newTx.amount), id: `${Date.now()}-${Math.random()}` }]);
            setNewTx({ date: new Date().toISOString().slice(0,10), description: '', amount: '', category: 'Misc', type: 'expense' });
        }
    };
    
    const handleFileChosen = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            const sampleData = lines.slice(1, 6).map(line => line.split(',').map(d => d.trim()));
            setCsvDataForMapping({ headers, sampleData, fullText: text });
            setShowCsvMapModal(true);
        };
        reader.readAsText(file);
        e.target.value = null; // Reset file input
    };
    
    const handleConfirmCsvMapping = (mapping) => {
        const { fullText } = csvDataForMapping;
        const lines = fullText.split('\n').slice(1).filter(line => line.trim() !== '');
        
        const newTransactions = lines.map(line => {
            try {
                const data = line.split(',');
                const requiredIndices = [mapping.date, mapping.description];
                if (mapping.amountType === 'single') requiredIndices.push(mapping.amount);
                else if (mapping.amountType === 'debit/credit') requiredIndices.push(mapping.debit, mapping.credit);
                else if (mapping.amountType === 'indicator') requiredIndices.push(mapping.amount, mapping.indicator);
                
                if (requiredIndices.some(index => index === -1 || index >= data.length)) {
                    console.warn("Skipping malformed CSV row (missing columns):", line);
                    return null;
                }

                const date = data[mapping.date];
                const description = data[mapping.description];
                let amount;
                let type;
                const category = mapping.category !== -1 ? data[mapping.category] || 'Imported' : 'Imported';

                if (mapping.amountType === 'single') {
                    const amountCell = data[mapping.amount];
                    if (typeof amountCell !== 'string') return null; 
                    const rawAmount = parseFloat(amountCell.replace(/[^0-9.-]+/g,""));
                    if (isNaN(rawAmount)) return null;
                    amount = Math.abs(rawAmount);
                    type = rawAmount >= 0 ? 'income' : 'expense';
                } else if (mapping.amountType === 'debit/credit') {
                    const debitCell = data[mapping.debit];
                    const creditCell = data[mapping.credit];
                    const debit = parseFloat((typeof debitCell === 'string' ? debitCell : '0').replace(/[^0-9.-]+/g,"")) || 0;
                    const credit = parseFloat((typeof creditCell === 'string' ? creditCell : '0').replace(/[^0-9.-]+/g,"")) || 0;
                    if (credit > 0) {
                        amount = credit;
                        type = 'income';
                    } else if (debit > 0) {
                        amount = debit;
                        type = 'expense';
                    } else return null; 
                } else if (mapping.amountType === 'indicator') {
                    const amountCell = data[mapping.amount];
                    const indicatorCell = data[mapping.indicator]?.trim();
                    if (typeof amountCell !== 'string' || typeof indicatorCell !== 'string') return null;
                    const rawAmount = parseFloat(amountCell.replace(/[^0-9.-]+/g,""));
                    if (isNaN(rawAmount)) return null;
                    amount = Math.abs(rawAmount);

                    if (indicatorCell.toLowerCase() === mapping.creditIndicator.toLowerCase()) {
                        type = 'income';
                    } else if (indicatorCell.toLowerCase() === mapping.debitIndicator.toLowerCase()) {
                        type = 'expense';
                    } else {
                        return null;
                    }
                }
                
                if (!date || !description || typeof amount === 'undefined' || isNaN(amount)) return null;

                return { id: `${Date.now()}-${Math.random()}`, date, description, amount, category, type };
            } catch (error) {
                console.error("Error processing line:", line, error);
                return null;
            }
        }).filter(Boolean);

        setTransactions(prev => [...prev, ...newTransactions]);
        setCashflowSource('statement');
        setShowCsvMapModal(false);
        setCsvDataForMapping(null);
        setActiveTab('transactions');
    };

    const baseTransactions = useMemo(() => {
        if (cashflowSource === 'sheet') {
            const monthlyIncomeTransactions = incomeData.map((i, index) => {
                let monthlyAmount = i.Amount || 0;
                const frequency = (i.Frequency || '').trim().toLowerCase();
                switch (frequency) {
                    case 'weekly': monthlyAmount *= 4.33; break;
                    case 'bi-weekly': monthlyAmount *= 2.167; break;
                    case 'yearly': case 'annually': monthlyAmount /= 12; break;
                    case 'bi-monthly': monthlyAmount /= 2; break;
                    case 'quarterly': monthlyAmount /= 3; break;
                    default: break;
                }
                return {
                    id: `income-${i['Income Source']}-${index}`,
                    date: 'Monthly',
                    description: i['Income Source'],
                    amount: monthlyAmount,
                    category: 'Income',
                    type: 'income'
                };
            });

            return [
                ...billData.map((b, index) => ({id: `bill-${b['Bill Name']}-${index}`, date: 'Monthly', description: b['Bill Name'], amount: b.Amount, category: b.Category || 'Uncategorized', type: 'expense'})),
                ...debtData.map((d, index) => ({id: `debt-${d['Debt Name']}-${index}`, date: 'Monthly', description: `Payment for ${d['Debt Name']}`, amount: d['minimum payment'], category: 'Debt', type: 'expense'})),
                ...monthlyIncomeTransactions
            ];
        }
        return transactions;
    }, [incomeData, billData, debtData, transactions, cashflowSource]);

    const dateFilteredTransactions = useMemo(() => {
        return baseTransactions.filter(t => {
            if (cashflowSource === 'sheet') return true;
            const txDate = new Date(t.date);
            if (isNaN(txDate.getTime())) return false;

            const now = new Date();
            if (dateFilter.type === 'thisMonth') {
                return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
            }
            if (dateFilter.type === 'thisYear') {
                return txDate.getFullYear() === now.getFullYear();
            }
            if (dateFilter.type === 'custom' && dateFilter.start && dateFilter.end) {
                const start = new Date(dateFilter.start);
                const end = new Date(dateFilter.end);
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
                return txDate >= start && txDate <= end;
            }
            return true;
        });
    }, [baseTransactions, dateFilter, cashflowSource]);

    const { summary, categoryData } = useMemo(() => {
        const incomeTx = dateFilteredTransactions.filter(t => t.type === 'income');
        const expenseTx = dateFilteredTransactions.filter(t => t.type === 'expense');

        const totalIncome = incomeTx.reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = expenseTx.reduce((sum, t) => sum + t.amount, 0);
        const netCashflow = totalIncome - totalExpenses;

        const categories = {};
        expenseTx.forEach(t => {
            const cat = t.category || 'Uncategorized';
            if (!categories[cat]) categories[cat] = 0;
            categories[cat] += t.amount;
        });
        const categoryDataResult = Object.entries(categories).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

        return {
            summary: { totalIncome, totalExpenses, netCashflow },
            categoryData: categoryDataResult,
        };
    }, [dateFilteredTransactions]);
    
    const finalCombinedTransactions = useMemo(() => {
        return dateFilteredTransactions.filter(tx => {
            return Object.entries(mainTableFilters).every(([key, selectedSet]) => {
                if (!selectedSet || selectedSet.size === 0) return true;
                const value = tx[key] || (key === 'category' ? 'Uncategorized' : '');
                return selectedSet.has(value);
            });
        });
    }, [dateFilteredTransactions, mainTableFilters]);
    
    const categoryDrilldownTransactions = useMemo(() => {
        if (!selectedCategory) return [];
        const categoryTx = dateFilteredTransactions.filter(tx => (tx.category || 'Uncategorized') === selectedCategory);
        
        return categoryTx.filter(tx => {
            return Object.entries(overviewTableFilters).every(([key, selectedSet]) => {
                if (!selectedSet || selectedSet.size === 0) return true;
                const value = tx[key] || (key === 'category' ? 'Uncategorized' : '');
                return selectedSet.has(value);
            });
        });
    }, [selectedCategory, dateFilteredTransactions, overviewTableFilters]);

    const handleBarClick = (data) => {
        if (data && data.activePayload && data.activePayload.length > 0) {
            const categoryName = data.activePayload[0].payload.name;
            setSelectedCategory(prev => prev === categoryName ? null : categoryName); // Toggle selection
            setOverviewTableFilters({}); // Reset filters when category changes
        }
    };
    
    const generateSpendingInsights = async () => {
        if (categoryData.length === 0) return;
        
        setInsightsLoading(true);
        setShowInsightsModal(true);
        setInsights('');

        const prompt = `
            You are a forensic financial analyst and coach. Your goal is to provide a comprehensive, actionable analysis of the user's spending to help them gain control and optimize their finances. The tone should be professional, insightful, and empowering.

            **User's Financial Snapshot:**
            - **Total Income:** $${summary.totalIncome.toFixed(2)}
            - **Total Expenses:** $${summary.totalExpenses.toFixed(2)}
            - **Net Cashflow:** $${summary.netCashflow.toFixed(2)}

            **Spending Breakdown by Category:**
            ${categoryData.map(c => `- ${c.name}: $${c.value.toFixed(2)}`).join('\n')}

            **Your Task:**
            Generate a detailed financial analysis and action plan. Structure your response with the following sections using the specified formatting:

            **Overall Financial Health:**
            Start with a concise summary of their financial position based on the net cashflow.

            **Deep-Dive Spending Analysis:**
            Identify the top 3 spending categories. For each, provide a detailed analysis. Go beyond generic advice. Identify potential "spending leaks" or opportunities. For example, if "Subscriptions" is high, suggest a specific audit process. If "Groceries" is high, suggest meal planning strategies or specific apps for savings.

            **Actionable Savings Roadmap:**
            Create a clear, step-by-step plan. Provide 3-5 specific, measurable, and realistic actions the user can take in the next 30 days. Frame these as challenges or goals. For example: "Challenge 1: Reduce 'Dining Out' by 15% ($XX) this month by packing lunch 3 times a week."

            **Concluding Motivation:**
            End with a powerful, motivational paragraph that inspires the user to take action and feel in control of their financial future.

            **Formatting Instructions:**
            - Use **double asterisks** for main section headings (e.g., **Overall Financial Health**).
            - Use a hyphen (-) for bullet points within sections.
        `;

        try {
            // Use Vercel API endpoint instead of direct Gemini API call
            const response = await fetch('/api/generateAIPlan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            
            let insightsText = "Could not generate insights at this time. Please try again later.";
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
              insightsText = result.candidates[0].content.parts[0].text;
            }
            setInsights(insightsText);

        } catch (error) {
            console.error("Error generating spending insights:", error);
            setInsights("Error: Could not connect to the AI analysis service.");
        } finally {
            setInsightsLoading(false);
        }
    };


    return (
        <>
        {showCsvMapModal && (
            <CsvMappingModal 
                headers={csvDataForMapping.headers}
                sampleData={csvDataForMapping.sampleData}
                onConfirm={handleConfirmCsvMapping}
                onCancel={() => setShowCsvMapModal(false)}
            />
        )}
        {showInsightsModal && (
            <SpendingInsightsModal
                insights={insights}
                isLoading={insightsLoading}
                onClose={() => setShowInsightsModal(false)}
            />
        )}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-200/80">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Cashflow Analysis</h2>
                {transactions.length > 0 && (
                    <div className="mt-4 sm:mt-0">
                        <span className="text-sm font-medium text-gray-600 mr-3">Data Source:</span>
                        <div className="inline-flex rounded-lg shadow-sm">
                            <button onClick={() => setCashflowSource('sheet')} className={`px-4 py-2 text-sm font-semibold rounded-l-lg transition-colors ${cashflowSource === 'sheet' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border'}`}>Sheet</button>
                            <button onClick={() => setCashflowSource('statement')} className={`px-4 py-2 text-sm font-semibold rounded-r-lg transition-colors ${cashflowSource === 'statement' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border'}`}>Statement</button>
                        </div>
                    </div>
                )}
            </div>
            
            {cashflowSource === 'statement' && transactions.length > 0 && (
                <div className="bg-indigo-50 border-l-4 border-indigo-500 text-indigo-800 p-4 rounded-md mb-6 shadow-sm">
                    <p className="text-sm font-medium">You are in <span className="font-bold">Statement Mode</span>. All calculations are based on your uploaded/manually added transactions.</p>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard icon={<ArrowUpCircle className="h-7 w-7 text-white"/>} title="Total Monthly Income" value={`$${summary.totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}`} color="bg-gradient-to-br from-green-500 to-emerald-600"/>
                <StatCard icon={<ArrowDownCircle className="h-7 w-7 text-white"/>} title="Total Monthly Expenses" value={`$${summary.totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}`} color="bg-gradient-to-br from-red-500 to-orange-600"/>
                <StatCard icon={<Banknote className="h-7 w-7 text-white"/>} title="Net Monthly Cashflow" value={`$${summary.netCashflow.toLocaleString(undefined, {minimumFractionDigits: 2})}`} color={summary.netCashflow >= 0 ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-amber-500 to-yellow-600"}/>
            </div>

            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('overview')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Overview</button>
                        <button onClick={() => setActiveTab('transactions')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'transactions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Transactions</button>
                        <button onClick={() => setActiveTab('upload')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'upload' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Upload Statement</button>
                    </nav>
                </div>
            </div>

            {activeTab === 'overview' && (
                <div id="cashflow-overview">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold">Spending by Category</h3>
                        <button 
                            onClick={generateSpendingInsights} 
                            disabled={insightsLoading}
                            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed">
                            {insightsLoading ? <Loader className="animate-spin h-5 w-5" /> : <Sparkles size={16}/>}
                            {insightsLoading ? 'Analyzing...' : 'Get AI Insights'}
                        </button>
                    </div>
                    {cashflowSource === 'statement' && (
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <button onClick={() => setDateFilter({type: 'thisMonth'})} className={`px-3 py-1 text-sm rounded-md ${dateFilter.type === 'thisMonth' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>This Month</button>
                            <button onClick={() => setDateFilter({type: 'thisYear'})} className={`px-3 py-1 text-sm rounded-md ${dateFilter.type === 'thisYear' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>This Year</button>
                            <button onClick={() => setDateFilter({type: 'custom', start: dateFilter.start, end: dateFilter.end})} className={`px-3 py-1 text-sm rounded-md ${dateFilter.type === 'custom' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Custom</button>
                            {dateFilter.type === 'custom' && (
                                <div className="flex items-center gap-2">
                                    <input type="date" value={dateFilter.start} onChange={e => setDateFilter(f => ({...f, start: e.target.value}))} className="text-sm border-gray-300 rounded-md shadow-sm"/>
                                    <span>to</span>
                                    <input type="date" value={dateFilter.end} onChange={e => setDateFilter(f => ({...f, end: e.target.value}))} className="text-sm border-gray-300 rounded-md shadow-sm"/>
                                </div>
                            )}
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }} onClick={handleBarClick}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(value) => `$${value.toLocaleString()}`} />
                            <YAxis type="category" dataKey="name" width={120} />
                            <RechartsTooltip formatter={(value) => `$${value.toLocaleString()}`} cursor={{fill: 'rgba(239, 246, 255, 0.5)'}} />
                            <Bar dataKey="value" name="Spending" radius={[0, 5, 5, 0]} style={{ cursor: 'pointer' }}>
                                {categoryData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    {selectedCategory && (
                        <div className="mt-8">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Transactions for '{selectedCategory}'</h3>
                                <button onClick={() => {setSelectedCategory(null); setOverviewTableFilters({});}} className="text-sm font-semibold text-indigo-600 hover:underline">Clear Filter</button>
                            </div>
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                                        <tr>
                                            <th className="p-3">Date</th>
                                            <th className="p-3">
                                                <FilterDropdown 
                                                    columnKey="description"
                                                    title="Description"
                                                    data={dateFilteredTransactions.filter(tx => (tx.category || 'Uncategorized') === selectedCategory)}
                                                    filters={overviewTableFilters}
                                                    onFilterChange={handleOverviewTableFilterChange}
                                                />
                                            </th>
                                            <th className="p-3 text-right">
                                                <div className="flex justify-end">
                                                    <FilterDropdown 
                                                        columnKey="type"
                                                        title="Amount"
                                                        predefinedItems={['income', 'expense']}
                                                        filters={overviewTableFilters}
                                                        onFilterChange={handleOverviewTableFilterChange}
                                                    />
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categoryDrilldownTransactions.map(tx => (
                                            <tr key={tx.id} className="border-b hover:bg-gray-50">
                                                <td className="p-3">{tx.date}</td>
                                                <td className="p-3 font-medium">{tx.description}</td>
                                                <td className={`p-3 text-right font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'transactions' && (
                <div id="cashflow-transactions">
                    <h3 className="text-xl font-bold mb-4">Add & View Transactions</h3>
                    {cashflowSource === 'statement' && (
                        <form onSubmit={handleAddTransaction} className="bg-slate-50 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                            <div className="md:col-span-2">
                                <label className="text-xs font-medium text-gray-600">Description</label>
                                <input type="text" value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} placeholder="e.g., Groceries, Paycheck" className="mt-1 w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600">Amount</label>
                                <input type="number" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} placeholder="50.00" className="mt-1 w-full border-gray-300 rounded-md shadow-sm"/>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600">Type</label>
                                <select value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value})} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                </select>
                            </div>
                            <button type="submit" className="bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 flex items-center justify-center gap-2 py-2">Add</button>
                        </form>
                    )}
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 text-xs text-gray-700 uppercase">
                                <tr>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">
                                        <FilterDropdown 
                                            columnKey="description"
                                            title="Description"
                                            data={dateFilteredTransactions}
                                            filters={mainTableFilters}
                                            onFilterChange={handleMainTableFilterChange}
                                        />
                                    </th>
                                    <th className="p-3">
                                        <FilterDropdown 
                                            columnKey="category"
                                            title="Category"
                                            data={dateFilteredTransactions}
                                            filters={mainTableFilters}
                                            onFilterChange={handleMainTableFilterChange}
                                        />
                                    </th>
                                    <th className="p-3 text-right">
                                        <div className="flex justify-end">
                                            <FilterDropdown 
                                                columnKey="type"
                                                title="Amount"
                                                predefinedItems={['income', 'expense']}
                                                filters={mainTableFilters}
                                                onFilterChange={handleMainTableFilterChange}
                                            />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {finalCombinedTransactions.map(tx => (
                                    <tr key={tx.id} className="border-b hover:bg-gray-50">
                                        <td className="p-3">{tx.date}</td>
                                        <td className="p-3 font-medium">{tx.description}</td>
                                        <td className="p-3">{tx.category}</td>
                                        <td className={`p-3 text-right font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'upload' && (
                <div id="cashflow-upload" className="text-center max-w-lg mx-auto">
                    <UploadCloud className="mx-auto h-16 w-16 text-gray-400" />
                    <h3 className="mt-2 text-xl font-bold text-gray-900">Upload your bank statement</h3>
                    <p className="mt-1 text-sm text-gray-500">Upload a CSV file to automatically import your transactions. No data is saved on our servers.</p>
                    <div className="mt-6">
                        <input type="file" id="csv-upload" accept=".csv" onChange={handleFileChosen} className="sr-only" />
                        <label htmlFor="csv-upload" className="cursor-pointer bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700">
                            Select CSV File
                        </label>
                    </div>
                    <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 text-blue-800 p-4 text-left text-sm">
                        <p className="font-bold flex items-center gap-2"><Info size={16}/> How it works:</p>
                        <p>After selecting a file, a mapper will appear. You'll match your file's columns (like 'Date', 'Details', 'Amount') to the required fields. This makes the tool compatible with any bank's statement format.</p>
                    </div>
                </div>
            )}
        </div>
        </>
    );
};

const CsvMappingModal = ({ headers, sampleData, onConfirm, onCancel }) => {
    const [mapping, setMapping] = useState({ date: '', description: '', amountType: 'single', amount: '', debit: '', credit: '', indicator: '', debitIndicator: 'Debit', creditIndicator: 'Credit', category: '' });

    const isComplete = useMemo(() => {
        if (!mapping.date || !mapping.description) return false;
        if (mapping.amountType === 'single' && !mapping.amount) return false;
        if (mapping.amountType === 'debit/credit' && (!mapping.debit || !mapping.credit)) return false;
        if (mapping.amountType === 'indicator' && (!mapping.amount || !mapping.indicator)) return false;
        return true;
    }, [mapping]);

    const handleConfirm = () => {
        const finalMapping = {
            date: headers.indexOf(mapping.date),
            description: headers.indexOf(mapping.description),
            amountType: mapping.amountType,
            amount: headers.indexOf(mapping.amount),
            debit: headers.indexOf(mapping.debit),
            credit: headers.indexOf(mapping.credit),
            indicator: headers.indexOf(mapping.indicator),
            debitIndicator: mapping.debitIndicator,
            creditIndicator: mapping.creditIndicator,
            category: headers.indexOf(mapping.category),
        };
        onConfirm(finalMapping);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 max-w-3xl w-full text-left relative">
                <button onClick={onCancel} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><X /></button>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Map Your CSV Columns</h2>
                <p className="text-sm text-gray-600 mb-6">Match the columns from your file to the required fields. This helps us understand your bank's format.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Date Column</label>
                        <select value={mapping.date} onChange={e => setMapping({...mapping, date: e.target.value})} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                            <option value="">Select a column...</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description Column</label>
                        <select value={mapping.description} onChange={e => setMapping({...mapping, description: e.target.value})} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                            <option value="">Select a column...</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Category Column (Optional)</label>
                        <select value={mapping.category} onChange={e => setMapping({...mapping, category: e.target.value})} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                            <option value="">Select a column...</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Amount Format</label>
                        <div className="mt-2 flex flex-col sm:flex-row gap-4">
                            <label className="flex items-center"><input type="radio" name="amountType" value="single" checked={mapping.amountType === 'single'} onChange={e => setMapping({...mapping, amountType: e.target.value})} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/> <span className="ml-2 text-sm">Single Column (+/-)</span></label>
                            <label className="flex items-center"><input type="radio" name="amountType" value="debit/credit" checked={mapping.amountType === 'debit/credit'} onChange={e => setMapping({...mapping, amountType: e.target.value})} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/> <span className="ml-2 text-sm">Debit/Credit Columns</span></label>
                            <label className="flex items-center"><input type="radio" name="amountType" value="indicator" checked={mapping.amountType === 'indicator'} onChange={e => setMapping({...mapping, amountType: e.target.value})} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/> <span className="ml-2 text-sm">Indicator Column</span></label>
                        </div>
                    </div>
                </div>

                {mapping.amountType === 'single' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Amount Column</label>
                        <select value={mapping.amount} onChange={e => setMapping({...mapping, amount: e.target.value})} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                            <option value="">Select a column...</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>
                )}
                {mapping.amountType === 'debit/credit' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Debit (Expense) Column</label>
                            <select value={mapping.debit} onChange={e => setMapping({...mapping, debit: e.target.value})} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="">Select a column...</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Credit (Income) Column</label>
                             <select value={mapping.credit} onChange={e => setMapping({...mapping, credit: e.target.value})} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="">Select a column...</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>
                )}
                {mapping.amountType === 'indicator' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Amount Column</label>
                            <select value={mapping.amount} onChange={e => setMapping({...mapping, amount: e.target.value})} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="">Select a column...</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Indicator Column</label>
                            <select value={mapping.indicator} onChange={e => setMapping({...mapping, indicator: e.target.value})} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="">Select a column...</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Text for Credit (Income)</label>
                            <input type="text" value={mapping.creditIndicator} onChange={e => setMapping({...mapping, creditIndicator: e.target.value})} className="mt-1 w-full border-gray-300 rounded-md shadow-sm"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Text for Debit (Expense)</label>
                            <input type="text" value={mapping.debitIndicator} onChange={e => setMapping({...mapping, debitIndicator: e.target.value})} className="mt-1 w-full border-gray-300 rounded-md shadow-sm"/>
                        </div>
                    </div>
                )}

                <div className="mt-6">
                    <h4 className="font-semibold text-sm mb-2">Data Preview</h4>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50"><tr className="text-left">{headers.map((h, i) => <th key={i} className="p-2 font-medium">{h}</th>)}</tr></thead>
                            <tbody className="bg-white divide-y divide-gray-200">{sampleData.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="p-2 whitespace-nowrap">{cell}</td>)}</tr>)}</tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button onClick={handleConfirm} disabled={!isComplete} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed">Import Transactions</button>
                </div>
            </div>
        </div>
    );
};


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

const FinancialGoalSetting = ({ portfolioValue, goals, setGoals, financialSummary, investmentData }) => {
    const [goalName, setGoalName] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [generatingPlanId, setGeneratingPlanId] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [currentGoal, setCurrentGoal] = useState(null);

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

    const openEditModal = (goal) => {
        setCurrentGoal(goal);
        setShowEditModal(true);
    };

    const handleUpdateGoal = (updatedGoal) => {
        setGoals(goals.map(g => g.id === updatedGoal.id ? updatedGoal : g));
        setShowEditModal(false);
    };

    const generatePlan = async (goalId) => {
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return;

        setGeneratingPlanId(goalId);

        const availableCash = financialSummary.totalMonthlyIncome - financialSummary.totalMonthlyBills - financialSummary.totalMinimumPayment;

        const prompt = `
            You are an investment and savings advisor. Your goal is to create a realistic, motivating, and detailed savings plan to help the user achieve their financial goal.

            **User's Goal & Financial Context:**
            - **Goal Name:** "${goal.name}"
            - **Target Amount:** $${goal.amount.toLocaleString()}
            - **Target Date:** ${goal.date}
            - **Current Available Cash for Savings/Investing (per month):** $${availableCash.toFixed(2)}

            **Your Task:**
            Generate a comprehensive "Goal Achievement Roadmap". Structure your response with the following sections:

            **Goal Feasibility Analysis:**
            First, calculate the required monthly savings to meet this goal. Compare this to their available cash. State clearly whether the goal is on track, challenging, or requires significant changes.

            **Strategic Action Plan:**
            Based on your analysis, provide a detailed, step-by-step plan.
            * If the goal is on track, outline a simple plan to allocate the required funds monthly.
            * If the goal is challenging or off-track, provide specific, creative strategies. These must be actionable. For example:
                - "Re-allocate funds: Your cashflow analysis shows you spend $X on [Category]. Consider reducing this by Y% to free up an extra $Z for this goal."
                - "Income Boost: Suggest 1-2 realistic side-hustle ideas that could bridge the savings gap."
                - "Timeline Adjustment: If necessary, calculate and suggest a more realistic target date."
            
            **Investment Suggestions (Optional but Recommended):**
            Briefly suggest the *type* of investment account that might be suitable for this goal's timeline (e.g., "For a long-term goal like this, consider a low-cost index fund in a brokerage account," or "For a short-term goal, a High-Yield Savings Account is a safe choice.").

            **Motivation & Next Steps:**
            Conclude with an encouraging paragraph and a clear, simple "first step" the user can take today to start their journey.

            **Formatting Instructions:**
            - Use **double asterisks** for main section headings.
            - Use a hyphen (-) for bullet points.
        `;

        try {
            // Use Vercel API endpoint instead of direct Gemini API call
            const response = await fetch('/api/generateAIPlan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
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
        <>
        {showEditModal && <EditGoalModal goal={currentGoal} onSave={handleUpdateGoal} onCancel={() => setShowEditModal(false)} />}
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
                    const fundedAmount = investmentData
                        .filter(inv => inv['Goals'] === goal.name)
                        .reduce((sum, current) => sum + (current.Value || 0), 0);
                    const progress = goal.amount > 0 ? Math.min((fundedAmount / goal.amount) * 100, 100) : 0;
                    const neededAmount = Math.max(0, goal.amount - fundedAmount);
                    
                    return (
                        <div key={goal.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold">{goal.name}</h4>
                                    <p className="text-sm text-gray-600">${goal.amount.toLocaleString()} by {new Date(goal.date).toLocaleDateString()}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEditModal(goal)} className="text-blue-600 hover:text-blue-800"><Edit size={16}/></button>
                                    <button onClick={() => removeGoal(goal.id)} className="text-red-500 hover:text-red-700"><Trash size={16}/></button>
                                </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                <div className="bg-teal-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                                <span className="text-green-600 font-semibold">Funded: ${fundedAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                <span className="text-gray-600">Needed: ${neededAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                            
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
                                    <div className="text-sm text-gray-700 whitespace-pre-wrap"><GeminiResponseParser text={goal.plan.text} /></div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
        </>
    );
};

const EditGoalModal = ({ goal, onSave, onCancel }) => {
    const [editedGoal, setEditedGoal] = useState(goal);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditedGoal(prev => ({ ...prev, [name]: name === 'amount' ? Number(value) : value }));
    };

    const handleSave = () => {
        onSave(editedGoal);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
                <h3 className="text-lg font-bold mb-4">Edit Goal</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Goal Name</label>
                        <input type="text" name="name" value={editedGoal.name} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Target Amount</label>
                        <input type="number" name="amount" value={editedGoal.amount} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Target Date</label>
                        <input type="date" name="date" value={editedGoal.date} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md shadow-sm"/>
                    </div>
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button onClick={handleSave} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700">Save Changes</button>
                </div>
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

const InvestmentPortfolioView = ({ data, riskProfile, setRiskProfile, goals, setGoals, generateInvestmentPDF, investmentPdfLoading, pdfLibrariesLoaded, totalValue, simplifiedAllocation, financialSummary, investmentData }) => {
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
            <FinancialGoalSetting portfolioValue={totalValue} goals={goals} setGoals={setGoals} financialSummary={financialSummary} investmentData={investmentData} />
            <InvestmentGrowthCalculator startingAmount={totalValue} isForPdf={investmentPdfLoading} />
            <RetirementReadinessSimulator startingAmount={totalValue} />
        </>
    )
}

const Footer = () => (
    <footer className="bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-slate-800/80 mt-16">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
                <div className="text-sm text-slate-600 dark:text-slate-400 text-center md:text-left">
                    <p className="font-semibold">Smart Steps to Wealth</p>
                    <p>&copy; {new Date().getFullYear()} All Rights Reserved.</p>
                </div>
                <div className="flex items-center space-x-6">
                    <a href="https://github.com/TheAugDev/smart-steps-to-wealth/discussions" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors" title="Community & Support">
                        <MessageSquare className="h-6 w-6" />
                        <span className="sr-only">Community</span>
                    </a>
                    <a href="https://www.youtube.com/@SmartStepsToWealth" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-500 transition-colors" title="YouTube Channel">
                        <Youtube className="h-6 w-6" />
                        <span className="sr-only">YouTube</span>
                    </a>
                    <a href="https://github.com/TheAugDev/smart-steps-to-wealth" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors" title="GitHub Repository">
                        <Github className="h-6 w-6" />
                        <span className="sr-only">GitHub</span>
                    </a>
                    <a href="mailto:AugmentedDev@outlook.com" className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors" title="Contact">
                        <Mail className="h-6 w-6" />
                        <span className="sr-only">Email</span>
                    </a>
                </div>
            </div>
            <div className="mt-8 pt-8 border-t border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-500">
                <p className="text-center">
                    <strong>Disclaimer:</strong> This tool is for informational and illustrative purposes only and does not constitute financial, legal, or tax advice. The projections and information provided are based on the data you input and certain assumptions, and are not a guarantee of future results. Please consult with a qualified professional before making any financial decisions.
                </p>
            </div>
        </div>
    </footer>
);

const App = () => {
    const [smartStepsUrl, setSmartStepsUrl] = useState('');
    const [debtData, setDebtData] = useState([]);
    const [billData, setBillData] = useState([]);
    const [incomeData, setIncomeData] = useState([]);
    const [investmentData, setInvestmentData] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [investmentPdfLoading, setInvestmentPdfLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showInstructions, setShowInstructions] = useState(true);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [currentView, setCurrentView] = useState('dashboard');
    const [cashflowSource, setCashflowSource] = useState('sheet');

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
    const [debtTableFilters, setDebtTableFilters] = useState({});
    const [billTableFilters, setBillTableFilters] = useState({});

    // --- AI Feature State ---
    const [showCoachModal, setShowCoachModal] = useState(false);
    const [debtCoachPlan, setDebtCoachPlan] = useState('');
    const [coachLoading, setCoachLoading] = useState(false);
    const [healthStatus, setHealthStatus] = useState('');
    
    // --- Local Storage & Auto-loading ---
    useEffect(() => {
        // Load all saved data from localStorage on initial mount
        const savedUrl = localStorage.getItem('smartStepsUrl');
        const savedRiskProfile = localStorage.getItem('riskProfile');
        const savedGoals = localStorage.getItem('financialGoals');
        const savedExtraPayment = localStorage.getItem('extraMonthlyPayment');
        const savedSnowflakes = localStorage.getItem('snowflakePayments');
        const savedTargetDebt = localStorage.getItem('targetDebt');
        const savedTransactions = localStorage.getItem('manualTransactions');
        const savedCashflowSource = localStorage.getItem('cashflowSource');

        if (savedUrl) {
            setSmartStepsUrl(savedUrl);
            setTimeout(() => processSheetData(savedUrl, true), 0); // Auto-load and navigate
        }
        if (savedRiskProfile) setRiskProfile(JSON.parse(savedRiskProfile));
        if (savedGoals) setGoals(JSON.parse(savedGoals));
        if (savedExtraPayment) setExtraMonthlyPayment(savedExtraPayment);
        if (savedSnowflakes) setSnowflakePayments(JSON.parse(savedSnowflakes));
        if (savedTargetDebt) setTargetDebt(savedTargetDebt);
        if (savedTransactions) {
            const parsedTransactions = JSON.parse(savedTransactions);
            if (parsedTransactions.length > 0) {
                setTransactions(parsedTransactions);
                if (savedCashflowSource) {
                    setCashflowSource(savedCashflowSource);
                } else {
                    setCashflowSource('statement'); // Default to statement if transactions exist
                }
            }
        }

    }, []); // Runs only once on initial component mount

    // --- Save data to localStorage whenever it changes ---
    useEffect(() => { localStorage.setItem('riskProfile', JSON.stringify(riskProfile)); }, [riskProfile]);
    useEffect(() => { localStorage.setItem('financialGoals', JSON.stringify(goals)); }, [goals]);
    useEffect(() => { localStorage.setItem('extraMonthlyPayment', extraMonthlyPayment); }, [extraMonthlyPayment]);
    useEffect(() => { localStorage.setItem('snowflakePayments', JSON.stringify(snowflakePayments)); }, [snowflakePayments]);
    useEffect(() => { localStorage.setItem('targetDebt', targetDebt); }, [targetDebt]);
    useEffect(() => { localStorage.setItem('manualTransactions', JSON.stringify(transactions)); }, [transactions]);
    useEffect(() => { localStorage.setItem('cashflowSource', cashflowSource); }, [cashflowSource]);

    const processSheetData = useCallback(async (url = smartStepsUrl, shouldNavigate = false) => {
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
            
            const investmentCols = ['Investment Name', 'Value', 'Type', 'Expense Ratio (%)', 'Dividend Yield (%)', 'Account Type', 'Goals'];
            setInvestmentData(normalize(data.investments, investmentCols).filter(i => i['Investment Name'] && typeof i['Value'] === 'number'));
            
            localStorage.setItem('smartStepsUrl', url);
            setShowInstructions(false);
            setIsDataLoaded(true);
            if(shouldNavigate) {
                setCurrentView('dashboard');
            }

        } catch (err) {
            setError(err.message || 'An unknown error occurred while loading data.');
            setIsDataLoaded(false);
        } finally {
            setLoading(false);
        }
    }, [smartStepsUrl]);

    // --- Auto-load data when URL is pasted ---
    useEffect(() => {
        // Check if the URL looks like a valid Google Apps Script deployment URL
        const isValidUrl = smartStepsUrl && 
            smartStepsUrl.includes('script.google.com') && 
            smartStepsUrl.includes('/exec') &&
            smartStepsUrl.length > 50; // Basic length check

        if (isValidUrl && !loading && !isDataLoaded) {
            // Add a small delay to avoid triggering on every character typed
            const timeoutId = setTimeout(() => {
                processSheetData();
            }, 1000); // 1 second delay after user stops typing

            return () => clearTimeout(timeoutId);
        }
    }, [smartStepsUrl, loading, isDataLoaded, processSheetData]);

    const clearAllData = () => {
        localStorage.clear();
        
        setSmartStepsUrl('');
        setDebtData([]); setBillData([]); setIncomeData([]); setInvestmentData([]); setTransactions([]);
        setRiskProfile(null);
        setGoals([]);
        setExtraMonthlyPayment('');
        setSnowflakePayments([]);
        setTargetDebt('strategy');
        setCashflowSource('sheet');

        setShowInstructions(true); 
        setIsDataLoaded(false);
        setCurrentView('dashboard');
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

    // --- Filtered Data ---
    const handleDebtTableFilterChange = (columnKey, selectedItems) => {
        setDebtTableFilters(prev => ({ ...prev, [columnKey]: selectedItems }));
    };

    const handleBillTableFilterChange = (columnKey, selectedItems) => {
        setBillTableFilters(prev => ({ ...prev, [columnKey]: selectedItems }));
    };

    const filteredDebtData = useMemo(() => {
        return debtData.filter(d => {
            if (!debtTableFilters['Debt Name'] || debtTableFilters['Debt Name'].size === 0) return true;
            return debtTableFilters['Debt Name'].has(d['Debt Name']);
        });
    }, [debtData, debtTableFilters]);

    const filteredBillData = useMemo(() => {
        return billData.filter(b => {
            if (!billTableFilters['Bill Name'] || billTableFilters['Bill Name'].size === 0) return true;
            return billTableFilters['Bill Name'].has(b['Bill Name']);
        });
    }, [billData, billTableFilters]);


    // --- Payoff Calculations ---
    const basePayoff = useMemo(() => {
        return calculatePayoff(filteredDebtData, strategy);
    }, [filteredDebtData, strategy]);
    
    const scenarioPayoff = useMemo(() => {
        return calculatePayoff(filteredDebtData, strategy, Number(extraMonthlyPayment) || 0, snowflakePayments, targetDebt);
    }, [filteredDebtData, strategy, extraMonthlyPayment, snowflakePayments, targetDebt]);
    
    useEffect(() => {
        const extraPaymentValue = Number(extraMonthlyPayment) || 0;
        setScenarioMode(extraPaymentValue > 0 || snowflakePayments.length > 0 || targetDebt !== 'strategy');
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
            filteredDebtData.forEach(debt => {
                const debtName = debt['Debt Name'];
                entry[`${debtName} (Base)`] = baseMonth[debtName];
                if (scenarioMode) { entry[`${debtName} (Scenario)`] = scenarioMonth[debtName]; }
            });
            combined.push(entry);
        }
        return combined;
    }, [basePayoff, scenarioPayoff, scenarioMode, filteredDebtData]);

    const addSnowflake = () => {
        const amount = Number(snowflakeAmount);
        const month = Number(snowflakeMonth);
        if (amount > 0 && month > 0) {
            const newSnowflakes = [...snowflakePayments, { month, amount }];
            const newScenarioPayoff = calculatePayoff(filteredDebtData, strategy, Number(extraMonthlyPayment) || 0, newSnowflakes, targetDebt);
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
        if (filteredDebtData.length === 0) return { totalDebt: 0, totalMinimumPayment: 0 };
        const totalDebtVal = filteredDebtData.reduce((acc, item) => acc + (item.Balance || 0), 0);
        const totalMinPay = filteredDebtData.reduce((acc, item) => acc + (item['minimum payment'] || 0), 0);
        return { totalDebt: totalDebtVal, totalMinimumPayment: totalMinPay };
    }, [filteredDebtData]);

    const { totalMonthlyBills, billsByCategory } = useMemo(() => {
        if(filteredBillData.length === 0) return { totalMonthlyBills: 0, billsByCategory: [] };
        const total = filteredBillData.reduce((acc, item) => acc + (item.Amount || 0), 0);
        const categories = {};
        filteredBillData.forEach(bill => {
            const category = bill['Category'] || 'Uncategorized';
            if(!categories[category]) categories[category] = 0;
            categories[category] += bill.Amount || 0;
        });
        return { totalMonthlyBills: total, billsByCategory: Object.keys(categories).map(name => ({name, value: categories[name]})) };
    }, [filteredBillData]);

    const { totalMonthlyIncome, incomeBySource } = useMemo(() => {
        if(incomeData.length === 0) return { totalMonthlyIncome: 0, incomeBySource: [] };
        const sourcesWithMonthlyValue = incomeData.map(item => {
            let monthlyAmount = item.Amount || 0;
            const frequency = item.Frequency ? item.Frequency.trim().toLowerCase() : '';
            switch (frequency) {
                case 'weekly':
                    monthlyAmount *= 4.33;
                    break;
                case 'bi-weekly':
                    monthlyAmount *= 2.167;
                    break;
                case 'yearly':
                case 'annually':
                    monthlyAmount /= 12;
                    break;
                case 'bi-monthly':
                    monthlyAmount /= 2;
                    break;
                case 'quarterly':
                    monthlyAmount /= 3;
                    break;
                default: // Assumes monthly
                    break;
            }
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
            if (filteredDebtData.length > 0) {
                if (yPos > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); yPos = 20; }
                doc.setFontSize(16);
                doc.text("Debt Details", 14, yPos);
                yPos += 8;
                const debtHead = [['Debt Name', 'Balance', 'APR (%)', 'Min. Payment', 'Payoff Date']];
                const debtBody = filteredDebtData.map(d => {
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
            if (filteredBillData.length > 0) {
                if (yPos > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); yPos = 20; }
                doc.setFontSize(16);
                doc.text("Monthly Bills", 14, yPos);
                yPos += 8;
                const billHead = [['Bill', 'Category', 'Amount']];
                const billBody = filteredBillData.map(b => [b['Bill Name'], b['Category'], `$${b.Amount.toLocaleString()}`]);
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
    
    const generateDebtCoachPlan = async () => {
        setCoachLoading(true);
        setShowCoachModal(true);
        setDebtCoachPlan('');
        setHealthStatus('');

        const snowballPayoff = calculatePayoff(filteredDebtData, 'snowball');
        const avalanchePayoff = calculatePayoff(filteredDebtData, 'avalanche');

        const prompt = `
            You are an expert Certified Financial Planner (CFP®) specializing in debt elimination strategies. Your goal is to provide a comprehensive, data-driven, and highly personalized "Debt Freedom Plan" that rivals or exceeds the quality of a human financial advisor.

            **Client's Financial Dashboard:**
            - **Total Debt:** $${totalDebt.toLocaleString(undefined, {maximumFractionDigits: 0})} across ${filteredDebtData.length} accounts.
            - **Debt-to-Income (DTI) Ratio:** ${debtToIncomeRatio.toFixed(2)}%
            - **Total Monthly Income:** $${totalMonthlyIncome.toLocaleString(undefined, {maximumFractionDigits: 0})}
            - **Surplus Cash Flow (after bills & minimums):** $${(totalMonthlyIncome - totalMonthlyBills - totalMinimumPayment).toLocaleString(undefined, {maximumFractionDigits: 0})} per month.

            **Debt Portfolio:**
            ${filteredDebtData.map(d => `- ${d['Debt Name']}: Balance $${d.Balance.toLocaleString()}, APR ${d.APR}%`).join('\n')}

            **Strategy Comparison Data:**
            - **Debt Snowball:** Payoff in ${snowballPayoff.months} months, Total Interest Paid $${snowballPayoff.totalInterest.toLocaleString(undefined, {maximumFractionDigits: 0})}.
            - **Debt Avalanche:** Payoff in ${avalanchePayoff.months} months, Total Interest Paid $${avalanchePayoff.totalInterest.toLocaleString(undefined, {maximumFractionDigits: 0})}.

            **Your Task:**
            First, on a single, separate line, provide a machine-readable status tag based on the DTI ratio. Use these exact tags:
            - If DTI <= 36%: STATUS: Excellent
            - If DTI > 36% and <= 42%: STATUS: Good
            - If DTI > 42% and <= 49%: STATUS: Needs Improvement
            - If DTI >= 50%: STATUS: High Alert

            Then, after a newline, generate a detailed, multi-part "Debt Freedom Plan". Use a professional, empowering, and analytical tone.

            **Executive Summary:**
            Start with a brief overview of the client's current debt situation and the potential for them to become debt-free.

            **DTI Ratio Analysis:**
            Explain what their ${debtToIncomeRatio.toFixed(2)}% DTI ratio means in the context of financial health (e.g., optimal, manageable, concerning) and why it's a critical metric.

            **Strategic Recommendation: Snowball vs. Avalanche:**
            Provide a detailed comparison of the two strategies using the data above. **Do not use a markdown table.** Instead, present the information as two separate sections, one for "Debt Snowball" and one for "Debt Avalanche". Under each section, use bullet points to list the Payoff Time, Total Interest Paid, Pros, and Cons. After presenting both, provide a definitive recommendation on which strategy is likely best for them and provide a strong justification.

            **The Personalized Debt Freedom Plan:**
            This is the core of your advice. Create a detailed, step-by-step action plan.
            * **Step 1: Solidify Your Attack Plan.** Instruct them to select the recommended strategy in the tool.
            * **Step 2: Automate and Amplify.** Advise them on how to automate their minimum payments and set up a recurring extra payment using their surplus cash flow.
            * **Step 3: Unleash Financial Accelerators.** Provide 2-3 highly specific and creative ideas for them to increase their debt-payoff velocity. Examples: "Conduct a subscription audit: Review your 'Bills' tab and aim to cut one service, applying that $15-30/month directly to your target debt." or "Consider a 'debt-blitz' weekend: Dedicate one weekend to a gig like food delivery or freelance work with a goal of making an extra $200 'snowflake' payment."
            
            **Staying the Course:**
            Include a short section on motivation, emphasizing the importance of tracking progress with this dashboard and celebrating small wins.

            **Formatting Instructions:**
            - Use **double asterisks** for main section headings.
            - Use a hyphen (-) for bullet points.
        `;

        try {
            // Use Vercel API endpoint instead of direct Gemini API call
            const response = await fetch('/api/generateAIPlan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            
            let fullText = "Could not generate a plan at this time. Please try again later.";
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
              fullText = result.candidates[0].content.parts[0].text;
            }

            // Parse the status and the plan
            const lines = fullText.split('\n');
            const statusLine = lines.find(line => line.startsWith('STATUS:'));
            if (statusLine) {
                const status = statusLine.split(':')[1].trim();
                setHealthStatus(status);
                const planText = lines.filter(line => !line.startsWith('STATUS:')).join('\n');
                setDebtCoachPlan(planText);
            } else {
                setDebtCoachPlan(fullText);
                setHealthStatus('');
            }

        } catch (error) {
            console.error("Error generating debt coach plan:", error);
            setDebtCoachPlan("Error: Could not connect to the AI coaching service.");
            setHealthStatus('');
        } finally {
            setCoachLoading(false);
        }
    };

    const handlePrintDebtPlan = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>AI Debt Coach Report</title>');
        printWindow.document.write('<style>body { font-family: sans-serif; margin: 2rem; } h1, h2, h3 { color: #333; } table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; } .report-content { white-space: pre-wrap; word-wrap: break-word; } </style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write('<h1>AI Debt Coach Report</h1>');
        printWindow.document.write(`<h2>Financial Snapshot as of ${new Date().toLocaleDateString()}</h2>`);
        printWindow.document.write('<table>');
        printWindow.document.write(`<tr><td>Total Debt</td><td>$${totalDebt.toLocaleString()}</td></tr>`);
        printWindow.document.write(`<tr><td>Debt-to-Income Ratio</td><td>${debtToIncomeRatio.toFixed(2)}%</td></tr>`);
        printWindow.document.write(`<tr><td>Monthly Income</td><td>$${totalMonthlyIncome.toLocaleString()}</td></tr>`);
        printWindow.document.write(`<tr><td>Monthly Surplus</td><td>$${(totalMonthlyIncome - totalMonthlyBills - totalMinimumPayment).toLocaleString()}</td></tr>`);
        printWindow.document.write('</table>');
        printWindow.document.write('<h2>AI Generated Plan</h2>');
        // Sanitize the plan text to be safe for HTML
        const sanitizedPlan = debtCoachPlan.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        printWindow.document.write(`<div class="report-content">${sanitizedPlan}</div>`);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
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
            {showCoachModal && <DebtCoachModal plan={debtCoachPlan} isLoading={coachLoading} onClose={() => setShowCoachModal(false)} healthStatus={healthStatus} onPrint={handlePrintDebtPlan} />}
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
                             <div className="flex justify-center items-center gap-2 rounded-lg bg-slate-100 p-1 mb-4 max-w-md mx-auto">
                                <button onClick={() => setCurrentView('dashboard')} className={`w-full px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${currentView === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-slate-200'}`}>Dashboard</button>
                                <button onClick={() => setCurrentView('cashflow')} className={`w-full px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${currentView === 'cashflow' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-slate-200'}`}>Cashflow</button>
                                <button onClick={() => setCurrentView('debt')} className={`w-full px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${currentView === 'debt' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-slate-200'}`}>Debt</button>
                                <button onClick={() => setCurrentView('investment')} className={`w-full px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${currentView === 'investment' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-600 hover:bg-slate-200'}`}>Investment</button>
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

                {isDataLoaded && currentView === 'dashboard' && (
                    <div>
                        <h2 className="text-3xl font-bold text-gray-800 mb-6">Overall Financial Dashboard</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <StatCard icon={<Banknote className="h-6 w-6 text-white"/>} title="Net Worth" value={`$${(totalValue - totalDebt).toLocaleString()}`} color="bg-indigo-500" tooltipText="Your total investments minus your total debts."/>
                            <StatCard icon={<ArrowLeftRight className="h-6 w-6 text-white"/>} title="Monthly Net Cashflow" value={`$${(totalMonthlyIncome - totalMonthlyObligations).toLocaleString()}`} color={ (totalMonthlyIncome - totalMonthlyObligations) >= 0 ? "bg-green-500" : "bg-red-500"} />
                            <StatCard icon={<Landmark className="h-6 w-6 text-white"/>} title="Total Investments" value={`$${totalValue.toLocaleString()}`} color="bg-teal-500" />
                            <StatCard icon={<TrendingDown className="h-6 w-6 text-white"/>} title="Total Debt" value={`$${totalDebt.toLocaleString()}`} color="bg-red-500" />
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md text-center">
                            <h3 className="text-2xl font-bold text-gray-800">Ready for your Financial Check-up?</h3>
                            <p className="text-gray-600 mt-2 mb-6 max-w-2xl mx-auto">Get a comprehensive analysis of your entire financial picture, from spending habits to investment strategies, all in one report.</p>
                            <button 
                                onClick={generateDebtCoachPlan}
                                disabled={coachLoading}
                                className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3 mx-auto disabled:from-gray-400 disabled:to-gray-500">
                                {coachLoading ? <Loader className="animate-spin h-5 w-5" /> : <Sparkles />}
                                {coachLoading ? 'Analyzing...' : 'Get My AI Financial Plan'}
                            </button>
                        </div>
                    </div>
                )}

                {isDataLoaded && currentView === 'cashflow' && (
                    <CashflowView 
                        incomeData={incomeData}
                        billData={billData}
                        debtData={debtData}
                        transactions={transactions}
                        setTransactions={setTransactions}
                        cashflowSource={cashflowSource}
                        setCashflowSource={setCashflowSource}
                    />
                )}


                {isDataLoaded && currentView === 'debt' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                           <StatCard icon={<DollarSign className="h-6 w-6 text-white"/>} title="Total Debt" value={`$${totalDebt.toLocaleString()}`} color="bg-red-500" />
                           <StatCard icon={<ClipboardList className="h-6 w-6 text-white"/>} title="Monthly Bills" value={`$${totalMonthlyBills.toLocaleString()}`} color="bg-yellow-500" />
                           <StatCard icon={<TrendingUp className="h-6 w-6 text-white"/>} title="Total Monthly Obligations" value={`$${totalMonthlyObligations.toLocaleString()}`} color="bg-purple-500"/>
                           <StatCard 
                                icon={<Calendar className="h-6 w-6 text-white"/>} 
                                title={`Debt-Free In (${strategy.charAt(0).toUpperCase() + strategy.slice(1)})`} 
                                value={`${basePayoff.months} months`}
                                baseValue={scenarioMode ? `${scenarioPayoff.months} months` : null}
                                color="bg-blue-500"
                            />
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
                            <div className="flex flex-col md:flex-row justify-between md:items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">Debt Payoff Plan</h2>
                                    <p className="text-sm text-gray-500">Select a strategy, model your future, and get expert AI advice.</p>
                                </div>
                                <div className="flex items-center gap-4 mt-4 md:mt-0">
                                    <button 
                                        onClick={generateDebtCoachPlan} 
                                        disabled={coachLoading}
                                        className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed">
                                        {coachLoading ? <Loader className="animate-spin h-5 w-5" /> : <Sparkles size={16}/>}
                                        {coachLoading ? 'Thinking...' : 'Ask AI Debt Coach'}
                                    </button>
                                    <button onClick={generatePDF} disabled={!pdfLibrariesLoaded || pdfLoading} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                        {pdfLoading ? <Loader className="animate-spin h-4 w-4" /> : <Download size={16}/>}
                                        {pdfLoading ? 'Generating...' : 'Download Report'}
                                    </button>
                                </div>
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
                                                        {filteredDebtData.map((debt, index) => ( <option key={`${debt['Debt Name']}-${index}`} value={debt['Debt Name']}> {debt['Debt Name']} </option> ))}
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
                            
                            {/* Strategy Summary Status Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                <StatCard 
                                    icon={<Clock className="h-7 w-7 text-white"/>} 
                                    title="Payoff Time" 
                                    value={`${payoffData.months} months`}
                                    baseValue={scenarioMode ? `${basePayoff.months} months` : null}
                                    color="bg-gradient-to-br from-blue-500 to-indigo-600"
                                />
                                <StatCard 
                                    icon={<DollarSign className="h-7 w-7 text-white"/>} 
                                    title="Total Interest" 
                                    value={`$${payoffData.totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                                    baseValue={scenarioMode ? `$${basePayoff.totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : null}
                                    color="bg-gradient-to-br from-red-500 to-orange-600"
                                    tooltipText="Total interest you'll pay over the life of all debts based on your selected strategy and payment plan."
                                />
                                <StatCard 
                                    icon={<Target className="h-7 w-7 text-white"/>} 
                                    title="Strategy" 
                                    value={strategy === 'snowball' ? 'Debt Snowball' : 'Debt Avalanche'}
                                    color="bg-gradient-to-br from-purple-500 to-indigo-600"
                                    description={strategy === 'snowball' ? 'Smallest balance first' : 'Highest interest first'}
                                />
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
                                   {chartView === 'individual' && filteredDebtData.map((debt, index) => { const debtName = debt['Debt Name']; const isHidden = hiddenDebts.includes(debtName); return ( <React.Fragment key={debtName}> <Line type="monotone" dataKey={`${debtName} (Base)`} name={`${debtName} (Base)`} stroke={COLORS[index % COLORS.length]} strokeWidth={2} strokeDasharray="3 3" dot={false} hide={isHidden} /> {scenarioMode && ( <Line type="monotone" dataKey={`${debtName} (Scenario)`} name={`${debtName} (Scenario)`} stroke={COLORS[index % COLORS.length]} strokeWidth={3} dot={false} hide={isHidden} /> )} </React.Fragment> ); })}
                               </LineChart>
                           </ResponsiveContainer>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h3 className="text-xl font-bold mb-4">Debt Details & Amortization</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm"><thead className="bg-gray-100 text-xs text-gray-700 uppercase"><tr><th className="p-3"><FilterDropdown columnKey="Debt Name" title="Debt Name" data={debtData} filters={debtTableFilters} onFilterChange={handleDebtTableFilterChange} /></th><th className="p-3 text-right">Balance</th><th className="p-3 text-right">APR</th><th className="p-3 text-right">Payoff Date</th><th className="p-3 text-center">Actions</th></tr></thead><tbody>{filteredDebtData.map((debt, index) => { const payoffDate = new Date(); payoffDate.setMonth(payoffDate.getMonth() + (payoffData.debtPayoffDates[debt['Debt Name']] || 0)); return ( <tr key={index} className="border-b hover:bg-gray-50"><td className="p-3 font-medium">{debt['Debt Name']}</td><td className="p-3 text-right">${(debt.Balance || 0).toLocaleString()}</td><td className="p-3 text-right">{(debt.APR || 0).toFixed(2)}%</td><td className="p-3 text-right">{payoffData.debtPayoffDates[debt['Debt Name']] ? payoffDate.toLocaleDateString() : 'N/A'}</td><td className="p-3 text-center"><button onClick={() => viewAmortization(debt['Debt Name'])} className="text-blue-600 hover:text-blue-800 text-xs font-semibold">VIEW SCHEDULE</button></td></tr> )})}</tbody></table>
                                </div>
                            </div>
                            {billData.length > 0 && <div id="bills-pie-chart" className="bg-white p-6 rounded-lg shadow-md"> <h3 className="text-xl font-bold mb-4 flex items-center"><PieChartIcon className="h-5 w-5 mr-2 text-green-500"/>Monthly Bills by Category</h3> <ResponsiveContainer width="100%" height={300}> <PieChart> <Pie data={billsByCategory} cx="40%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}> {billsByCategory.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))} </Pie> <RechartsTooltip formatter={(value) => `$${value.toLocaleString()}`} /> <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ right: 0, paddingLeft: '20px' }}/> </PieChart> </ResponsiveContainer> </div> }
                        </div>
                        {billData.length > 0 && ( <div className="bg-white p-6 rounded-lg shadow-md mb-8"> <h3 className="text-xl font-bold mb-4">Bill Details</h3> <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-100 text-xs text-gray-700 uppercase"><tr><th className="p-3"><FilterDropdown columnKey="Bill Name" title="Bill Name" data={billData} filters={billTableFilters} onFilterChange={handleBillTableFilterChange} /></th><th className="p-3">Category</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{filteredBillData.map((bill, index) => ( <tr key={index} className="border-b hover:bg-gray-50"><td className="p-3 font-medium">{bill['Bill Name']}</td><td className="p-3">{bill['Category']}</td><td className="p-3 text-right">${(bill.Amount || 0).toLocaleString()}</td></tr>))}</tbody></table></div></div> )}
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
                        investmentData={investmentData}
                    />
                )}
            </div>
            <Footer />
        </div>
    );
};

export default App;
