import { useState } from "react";
import { CheckCircle, XCircle, FileText, User, Calendar as CalendarIcon, Paperclip, Download, Eye, AlertCircle, CheckCircle2, Brain, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import { formatRequestId } from "../../lib/requestId";

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedDate: string;
}

interface Signature {
  role: string;
  signatory: string;
  status: "signed" | "pending";
  signedDate?: string;
}

interface DSSRecommendation {
  decision: "approve" | "reject" | "review";
  confidence: number;
  reasons: string[];
  risks: string[];
}

interface Request {
  id: string;
  venue: string;
  date: string;
  time: string;
  purpose: string;
  requester: string;
  submittedDate: string;
  attachments?: Attachment[];
  signatures?: Signature[];
  dssRecommendation?: DSSRecommendation;
}

// Mock pending requests with enhanced data
const initialRequests: Request[] = [
  {
    id: "REQ-002",
    venue: "Parish Hall",
    date: "2026-02-20",
    time: "2:00 PM - 5:00 PM",
    purpose: "Youth Ministry Meeting",
    requester: "Fr. Michael Santos",
    submittedDate: "2026-02-01",
    attachments: [
      {
        id: "ATT-001",
        name: "Event_Proposal.pdf",
        type: "PDF Document",
        size: "2.3 MB",
        uploadedDate: "2026-02-01"
      },
      {
        id: "ATT-002",
        name: "Budget_Plan.xlsx",
        type: "Excel Spreadsheet",
        size: "1.1 MB",
        uploadedDate: "2026-02-01"
      }
    ],
    signatures: [
      {
        role: "Parish Coordinator",
        signatory: "Sr. Maria Lopez",
        status: "signed",
        signedDate: "2026-02-01"
      },
      {
        role: "Finance Officer",
        signatory: "Mr. Roberto Cruz",
        status: "signed",
        signedDate: "2026-02-02"
      },
      {
        role: "Safety Officer",
        signatory: "Mr. Juan Dela Cruz",
        status: "pending"
      }
    ],
    dssRecommendation: {
      decision: "review",
      confidence: 72,
      reasons: [
        "Similar events approved in the past (85% approval rate)",
        "Venue available on requested date",
        "Requester has good track record (no violations)"
      ],
      risks: [
        "One required signature still pending",
        "Event overlaps with another booking by 30 minutes"
      ]
    }
  },
  {
    id: "REQ-004",
    venue: "Chapel Garden",
    date: "2026-03-05",
    time: "3:00 PM - 6:00 PM",
    purpose: "Baptism Reception",
    requester: "Maria Cruz",
    submittedDate: "2026-02-02",
    attachments: [
      {
        id: "ATT-003",
        name: "Guest_List.docx",
        type: "Word Document",
        size: "856 KB",
        uploadedDate: "2026-02-02"
      }
    ],
    signatures: [
      {
        role: "Parish Coordinator",
        signatory: "Sr. Maria Lopez",
        status: "signed",
        signedDate: "2026-02-02"
      },
      {
        role: "Sacrament Coordinator",
        signatory: "Fr. Antonio Reyes",
        status: "signed",
        signedDate: "2026-02-03"
      }
    ],
    dssRecommendation: {
      decision: "approve",
      confidence: 94,
      reasons: [
        "All required signatures obtained",
        "No scheduling conflicts detected",
        "Sacramental events have priority",
        "Venue capacity matches expected attendance"
      ],
      risks: []
    }
  },
  {
    id: "REQ-005",
    venue: "Conference Room",
    date: "2026-02-18",
    time: "10:00 AM - 12:00 PM",
    purpose: "Ministry Coordinators Meeting",
    requester: "John Reyes",
    submittedDate: "2026-02-01",
    attachments: [],
    signatures: [
      {
        role: "Parish Coordinator",
        signatory: "Sr. Maria Lopez",
        status: "pending"
      },
      {
        role: "Administrative Head",
        signatory: "Bishop Antonio",
        status: "pending"
      }
    ],
    dssRecommendation: {
      decision: "reject",
      confidence: 68,
      reasons: [
        "Venue already has tentative booking for same time slot",
        "Requester's previous booking had compliance issues"
      ],
      risks: [
        "No required signatures obtained yet",
        "Missing supporting documentation",
        "Short notice for booking (less than 2 weeks)"
      ]
    }
  },
];

export function ApproverDashboard() {
  const [requests, setRequests] = useState<Request[]>(initialRequests);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [remarks, setRemarks] = useState("");

  const handleApprove = () => {
    if (selectedRequest) {
      alert(`Request ${formatRequestId(selectedRequest.id)} approved!`);
      setRequests(requests.filter((r) => r.id !== selectedRequest.id));
      setSelectedRequest(null);
      setRemarks("");
    }
  };

  const handleReject = () => {
    if (selectedRequest) {
      alert(`Request ${formatRequestId(selectedRequest.id)} rejected.`);
      setRequests(requests.filter((r) => r.id !== selectedRequest.id));
      setSelectedRequest(null);
      setRemarks("");
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-semibold text-slate-900 mb-3 tracking-tight">
          Pending Approvals
        </h1>
        <p className="text-lg text-slate-600">
          Review and approve or reject booking requests
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Requests List */}
        <div className="col-span-2 space-y-6">
          {/* DSS Insights Panel */}
          {selectedRequest && selectedRequest.dssRecommendation && (
            <div className={`bg-gradient-to-br ${
              selectedRequest.dssRecommendation.decision === "approve"
                ? "from-emerald-50 via-emerald-100/40 to-emerald-50"
                : selectedRequest.dssRecommendation.decision === "reject"
                ? "from-rose-50 via-rose-100/40 to-rose-50"
                : "from-amber-50 via-amber-100/40 to-amber-50"
            } border-2 ${
              selectedRequest.dssRecommendation.decision === "approve"
                ? "border-emerald-300"
                : selectedRequest.dssRecommendation.decision === "reject"
                ? "border-rose-300"
                : "border-amber-300"
            } rounded-2xl shadow-xl shadow-slate-900/10 p-8`}>
              <div className="flex items-start gap-5">
                <div className={`p-4 rounded-xl shadow-lg ${
                  selectedRequest.dssRecommendation.decision === "approve"
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/40"
                    : selectedRequest.dssRecommendation.decision === "reject"
                    ? "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/40"
                    : "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/40"
                }`}>
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 text-xl">
                      Decision Support System Analysis
                    </h3>
                    <span className={`px-4 py-2 text-sm font-bold rounded-full shadow-sm ${
                      selectedRequest.dssRecommendation.decision === "approve"
                        ? "bg-emerald-600 text-white shadow-emerald-600/30"
                        : selectedRequest.dssRecommendation.decision === "reject"
                        ? "bg-rose-600 text-white shadow-rose-600/30"
                        : "bg-amber-600 text-white shadow-amber-600/30"
                    }`}>
                      {selectedRequest.dssRecommendation.confidence}% Confidence
                    </span>
                  </div>
                  <p className="text-base text-slate-700 mb-6">
                    Recommendation: <span className="font-bold uppercase text-slate-900">
                      {selectedRequest.dssRecommendation.decision}
                    </span>
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Supporting Factors
                      </h4>
                      <ul className="space-y-1.5">
                        {selectedRequest.dssRecommendation.reasons.map((reason, index) => (
                          <li key={index} className="text-xs text-slate-700 flex items-start gap-2">
                            <span className="text-emerald-600 mt-0.5">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    {selectedRequest.dssRecommendation.risks.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Risk Factors
                        </h4>
                        <ul className="space-y-1.5">
                          {selectedRequest.dssRecommendation.risks.map((risk, index) => (
                            <li key={index} className="text-xs text-slate-700 flex items-start gap-2">
                              <span className="text-rose-600 mt-0.5">•</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-amber-50/30 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 text-xl">
                Pending Requests
              </h2>
              <span className="px-4 py-2 bg-gradient-to-br from-amber-500 to-amber-600 text-white text-sm font-bold rounded-full shadow-lg shadow-amber-500/40">
                {requests.length} pending
              </span>
            </div>

            {requests.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className={`p-6 cursor-pointer transition-all ${
                      selectedRequest?.id === request.id
                        ? "bg-blue-50 border-l-4 border-l-blue-600"
                        : "hover:bg-slate-50"
                    }`}
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-slate-900 mb-1.5 text-lg">
                          {formatRequestId(request.id)}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <FileText className="w-4 h-4 text-slate-500" />
                          <span className="font-medium">{request.venue}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {request.attachments && request.attachments.length > 0 && (
                          <span className="px-3 py-1.5 text-xs bg-blue-100 text-blue-800 border border-blue-300 rounded-full flex items-center gap-1.5 font-semibold">
                            <Paperclip className="w-3.5 h-3.5" />
                            {request.attachments.length}
                          </span>
                        )}
                        <span className="px-4 py-1.5 text-xs font-bold bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-full shadow-sm">
                          Pending
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <CalendarIcon className="w-4 h-4 text-slate-500" />
                        <span>{request.date}</span>
                      </div>
                      <div className="text-slate-600">{request.time}</div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <User className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">{request.requester}</span>
                      </div>
                      {request.signatures && (
                        <span className="text-xs text-slate-600 font-medium">
                          {request.signatures.filter(s => s.status === "signed").length}/{request.signatures.length} signatures
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-16 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-full mb-6 shadow-lg shadow-emerald-900/10">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <p className="text-slate-900 font-semibold text-lg">No pending requests</p>
                <p className="text-slate-500 mt-2">All caught up!</p>
              </div>
            )}
          </div>
        </div>

        {/* Request Details & Actions */}
        <div className="col-span-1">
          {selectedRequest ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 sticky top-6 overflow-hidden">
              <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900 text-xl">Request Details</h2>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Request ID</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatRequestId(selectedRequest.id)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Venue</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedRequest.venue}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date & Time</p>
                  <p className="text-sm font-semibold text-slate-900 mb-1">
                    {selectedRequest.date}
                  </p>
                  <p className="text-sm text-slate-700">
                    {selectedRequest.time}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Purpose</p>
                  <p className="text-sm text-slate-900">
                    {selectedRequest.purpose}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Requester</p>
                  <p className="text-sm text-slate-900">
                    {selectedRequest.requester}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Submitted On</p>
                  <p className="text-sm text-slate-900">
                    {selectedRequest.submittedDate}
                  </p>
                </div>

                {/* Attachments */}
                {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                  <div className="pt-5 border-t border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Attached Documents ({selectedRequest.attachments.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedRequest.attachments.map((attachment) => (
                        <div 
                          key={attachment.id} 
                          className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {attachment.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {attachment.type} • {attachment.size}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => alert(`Downloading ${attachment.name}...`)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signatures */}
                {selectedRequest.signatures && selectedRequest.signatures.length > 0 && (
                  <div className="pt-5 border-t border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Required Signatures ({selectedRequest.signatures.filter(s => s.status === "signed").length}/{selectedRequest.signatures.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedRequest.signatures.map((signature, index) => (
                        <div 
                          key={index}
                          className={`p-3 border rounded-lg ${
                            signature.status === "signed" 
                              ? "bg-emerald-50 border-emerald-200" 
                              : "bg-amber-50 border-amber-200"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2">
                              <div className={`p-1.5 rounded-full ${
                                signature.status === "signed" 
                                  ? "bg-emerald-500" 
                                  : "bg-amber-500"
                              }`}>
                                {signature.status === "signed" ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                ) : (
                                  <AlertCircle className="w-3.5 h-3.5 text-white" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {signature.signatory}
                                </p>
                                <p className="text-xs text-slate-600">
                                  {signature.role}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {signature.status === "signed" ? (
                                <div>
                                  <p className="text-xs font-medium text-emerald-700">
                                    Signed
                                  </p>
                                  <p className="text-xs text-emerald-600">
                                    {signature.signedDate}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs font-medium text-amber-700">
                                  Awaiting Signature
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remarks Field */}
                <div className="pt-5 border-t border-slate-200">
                  <label
                    htmlFor="remarks"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    Remarks (Optional)
                  </label>
                  <textarea
                    id="remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
                    placeholder="Add any notes or comments"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-5 border-t border-slate-200 space-y-3">
                  <button
                    onClick={handleApprove}
                    className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-xl shadow-emerald-900/30 hover:shadow-2xl hover:shadow-emerald-900/40 font-semibold text-base hover:-translate-y-0.5 transform"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve Request
                  </button>
                  <button
                    onClick={handleReject}
                    className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-xl hover:from-rose-700 hover:to-rose-800 transition-all shadow-xl shadow-rose-900/30 hover:shadow-2xl hover:shadow-rose-900/40 font-semibold text-base hover:-translate-y-0.5 transform"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject Request
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-xl shadow-slate-900/10">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-slate-100 to-blue-50 rounded-full mb-6 shadow-lg shadow-slate-900/10">
                <FileText className="w-10 h-10 text-slate-500" />
              </div>
              <p className="text-slate-900 font-semibold text-lg">Select a request</p>
              <p className="text-slate-500 mt-2">Click on a request to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}