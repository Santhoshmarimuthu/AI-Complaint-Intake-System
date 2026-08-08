import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Download,
  FileText,
  Paperclip,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { Provider, useDispatch, useSelector } from "react-redux";
import jsPDF from "jspdf";

import {
  addUserMessage,
  resetAll,
  resetFormOnly,
  setDbResult,
  setError,
  setLoading,
  setResult,
  setSubmitted,
  store,
  updateField,
} from "./store";

import {
  loadComplaint,
  searchComplaints,
  sendChat,
  sendText,
  submitComplaint,
  uploadComplaint,
} from "./api";

import "./styles.css";


const fields = [
  ["complaint_source", "Complaint Source"],
  ["customer_name", "Customer Name"],
  ["product_name", "Product Name"],
  ["product_strength_grade", "Product Strength / Grade"],
  ["batch_lot_number", "Batch / Lot Number"],
  ["manufacturing_date", "Manufacturing Date"],
  ["expiry_date", "Expiry Date"],
  ["quantity_affected", "Quantity Affected"],
  ["complaint_type", "Complaint Type"],
  ["complaint_date", "Complaint Date"],
  ["detailed_complaint_description", "Detailed Complaint Description"],
];


function App() {
  const dispatch = useDispatch();
  const fileRef = useRef(null);

  const {
    complaint,
    changedFields,
    messages,
    sessionId,
    loading,
    submitted,
    error,
    dbResult,
    riskAssessment,
    completeness,
    summary,
  } = useSelector((state) => state.complaint);

  const [chat, setChat] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const riskClass = String(riskAssessment?.level || "Unknown").toLowerCase();
  const completenessPercentage = completeness?.percentage ?? 0;
  const missingFields = completeness?.missing_fields || [];

  useEffect(() => {
    if (!showSearchResults) return undefined;

    const timer = setTimeout(async () => {
      try {
        const result = await searchComplaints(search);
        setSearchResults(result.complaints || []);
      } catch (err) {
        dispatch(setError(err.message));
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search, showSearchResults, dispatch]);


  const applyResult = (data) => {
    dispatch(setResult(data));
  };


  const handleFile = async (file) => {
    if (!file) return;

    dispatch(addUserMessage(`📎 ${file.name}`));
    dispatch(setLoading(true));

    try {
      const result = await uploadComplaint(file, sessionId);
      applyResult(result);
    } catch (err) {
      dispatch(setError(err.message));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };


  const handleChat = async () => {
    const message = chat.trim();
    if (!message) return;

    dispatch(addUserMessage(message));
    setChat("");
    dispatch(setLoading(true));

    try {
      const result = sessionId
        ? await sendChat(message, sessionId)
        : await sendText(message, null);

      applyResult(result);
    } catch (err) {
      dispatch(setError(err.message));
    }
  };


  const handleSearchFocus = () => {
    setShowSearchResults(true);
  };


  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setShowSearchResults(true);
  };


  const openComplaint = async (complaintId) => {
    dispatch(setLoading(true));

    try {
      const result = await loadComplaint(complaintId);

      applyResult(result);

      dispatch(addUserMessage(`Opened complaint #${complaintId} from PostgreSQL.`));

      setSearch("");
      setSearchResults([]);
      setShowSearchResults(false);
    } catch (err) {
      dispatch(setError(err.message));
    }
  };


  const handleSubmit = () => {
    if (!sessionId) {
      dispatch(setError("Upload or enter a complaint first."));
      return;
    }

    setConfirmOpen(true);
  };


  const confirmSubmit = async () => {
    setConfirmOpen(false);
    dispatch(setLoading(true));

    try {
      const result = await submitComplaint(sessionId);

      dispatch(setDbResult(result.result));

      if (!result.result?.success) {
        dispatch(setError(result.result?.message || "Duplicate complaint found."));
        setDuplicateOpen(true);
        return;
      }

      dispatch(setSubmitted(true));
      setSuccessOpen(true);
    } catch (err) {
      dispatch(setError(err.message));
    }
  };


  const resetForNewComplaint = () => {
    dispatch(resetFormOnly());
    setSuccessOpen(false);
  };


  const downloadForm = () => {
    const document = new jsPDF();
    const margin = 16;
    let y = 18;

    document.setFont("helvetica", "bold");
    document.setFontSize(16);
    document.text("Complaint Record", margin, y);

    y += 10;

    document.setFont("helvetica", "normal");
    document.setFontSize(9);

    fields.forEach(([key, label]) => {
      const value = complaint[key] || "—";
      const lines = document.splitTextToSize(`${label}: ${value}`, 178);

      if (y + lines.length * 5 > 275) {
        document.addPage();
        y = 18;
      }

      document.text(lines, margin, y);
      y += lines.length * 5 + 3;
    });

    if (y + 35 > 275) {
      document.addPage();
      y = 18;
    }

    document.setFont("helvetica", "bold");
    document.text("AI Risk Assessment", margin, y);

    y += 6;

    document.setFont("helvetica", "normal");

    const riskLines = document.splitTextToSize(
      `${riskAssessment.level}: ${riskAssessment.reason}`,
      178
    );

    document.text(riskLines, margin, y);
    y += riskLines.length * 5 + 8;

    document.setFont("helvetica", "bold");
    document.text("Complaint Completeness", margin, y);

    y += 6;

    document.setFont("helvetica", "normal");
    document.text(`${completenessPercentage}%`, margin, y);

    y += 10;

    document.setFont("helvetica", "bold");
    document.text("Detailed Complaint Summary", margin, y);

    y += 6;

    document.setFont("helvetica", "normal");

    const summaryLines = document.splitTextToSize(
      summary || "No summary available.",
      178
    );

    document.text(summaryLines, margin, y);

    document.save(
      `complaint-${complaint.batch_lot_number || "record"}.pdf`
    );
  };


  const riskDescription =
    riskAssessment?.reason ||
    "Insufficient information to assess risk.";


  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-symbols">
          <span>✦</span>
          <span>+</span>
          <span>✧</span>
        </div>

        <div>
          <div className="topbar-kicker">QUALITY ASSURANCE</div>
          <h1>Log Customer Complaint</h1>
          <p>API &amp; FDF Quality Assurance Module</p>
        </div>

        <div className={`status ${submitted ? "submitted" : ""}`}>
          {submitted ? "Submitted" : "Pending Triage"}
        </div>
      </header>


      <main className="page-background">
        <div className="top-workspace">

          {/* ================= FORM ================= */}

          <section className="panel form-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">COMPLAINT RECORD</div>
                <h2>Complaint Details</h2>
              </div>

              {Object.keys(changedFields).length > 0 && (
                <div className="change-note">
                  <span />
                  Updated values
                </div>
              )}
            </div>


            <Section title="1. ORIGIN & CUSTOMER DETAILS">
              <div className="grid">
                {fields.slice(0, 2).map(([key, label]) => (
                  <Field
                    key={key}
                    keyName={key}
                    label={label}
                    value={complaint[key]}
                    changed={changedFields[key]}
                    onChange={(value) =>
                      dispatch(updateField({ field: key, value }))
                    }
                  />
                ))}
              </div>
            </Section>


            <Section title="2. PRODUCT & BATCH IDENTIFICATION">
              <div className="grid">
                {fields.slice(2, 8).map(([key, label]) => (
                  <Field
                    key={key}
                    keyName={key}
                    label={label}
                    value={complaint[key]}
                    changed={changedFields[key]}
                    onChange={(value) =>
                      dispatch(updateField({ field: key, value }))
                    }
                  />
                ))}
              </div>
            </Section>


            <Section title="3. COMPLAINT DETAILS">
              <div className="grid">
                {fields.slice(8, 10).map(([key, label]) => (
                  <Field
                    key={key}
                    keyName={key}
                    label={label}
                    value={complaint[key]}
                    changed={changedFields[key]}
                    onChange={(value) =>
                      dispatch(updateField({ field: key, value }))
                    }
                  />
                ))}

                <Field
                  keyName="detailed_complaint_description"
                  label="Detailed Complaint Description"
                  value={complaint.detailed_complaint_description}
                  changed={changedFields.detailed_complaint_description}
                  textarea
                  full
                  onChange={(value) =>
                    dispatch(
                      updateField({
                        field: "detailed_complaint_description",
                        value,
                      })
                    )
                  }
                />
              </div>
            </Section>


            <Section title="4. AI ASSESSMENT">
              <div className="ai-assessment-grid">

                <div className="ai-assessment-card">
                  <div className="ai-card-header">
                    <div className={`ai-card-icon ${riskClass}`}>
                      <ShieldCheck size={16} />
                    </div>

                    <div>
                      <strong>AI Risk Assessment</strong>
                      <span>AI-generated from complaint information</span>
                    </div>
                  </div>

                  <div className={`risk-value ${riskClass}`}>
                    {riskAssessment.level || "Unknown"}
                  </div>

                  <p>{riskDescription}</p>
                </div>


                <div className="ai-assessment-card">
                  <div className="ai-card-header">
                    <div className="ai-card-icon completeness">
                      <CheckCircle2 size={16} />
                    </div>

                    <div>
                      <strong>Complaint Completeness</strong>
                      <span>Required information check</span>
                    </div>
                  </div>

                  <div className="completeness-value">
                    {completenessPercentage}%
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${completenessPercentage}%` }}
                    />
                  </div>

                  <p>
                    {missingFields.length === 0
                      ? "All required information is available."
                      : `Missing: ${missingFields
                          .map((field) => field.replaceAll("_", " "))
                          .join(", ")}`}
                  </p>
                </div>

              </div>
            </Section>


            <div className="form-actions">
              <button
                className="secondary"
                onClick={() => dispatch(resetAll())}
                disabled={loading}
              >
                <RotateCcw size={14} />
                Reset
              </button>

              <button
                className="primary"
                disabled={loading || submitted}
                onClick={handleSubmit}
              >
                Submit Complaint
              </button>
            </div>


            {submitted && (
              <div className="download-area">
                <div className="download-success">
                  <CheckCircle2 size={18} />

                  <div>
                    <strong>Complaint submitted successfully</strong>
                    <span>
                      Complaint ID: {dbResult?.complaint_id ?? "—"}
                    </span>
                  </div>
                </div>

                <button className="download-btn" onClick={downloadForm}>
                  <Download size={15} />
                  Download Form
                </button>

                <button className="new-btn" onClick={resetForNewComplaint}>
                  New Complaint
                </button>
              </div>
            )}
          </section>


          {/* ================= CHAT ================= */}

          <section className="panel assistant-panel">
            <div className="assistant-header">
              <div className="assistant-title">
                <div className="assistant-symbol">
                  <Bot size={18} />
                </div>

                <div>
                  <strong>AI Complaint Intake Assistant</strong>
                  <span>Stateful complaint conversation</span>
                </div>
              </div>

              <span className="beta">BETA</span>
            </div>


            {/* SEARCH COMPLAINTS */}

            <div className="conversation-search">
              <div className="search-title">
                <Search size={14} />
                Search Complaints
              </div>

              <div className="search-wrap">
                <Search size={14} />

                <input
                  value={search}
                  onFocus={handleSearchFocus}
                  onChange={handleSearchChange}
                  placeholder="Search ID, customer, product, batch..."
                />

                {search.length > 0 && (
                  <button
                    type="button"
                    className="search-clear"
                    title="Clear search"
                    onClick={() => {
                      setSearch("");
                      setSearchResults([]);
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>


              {showSearchResults && (
                <div className="search-results">

                  <div className="search-results-header">
                    <span>Search results</span>

                    <button
                      type="button"
                      className="close-search"
                      title="Close suggestions"
                      onClick={() => setShowSearchResults(false)}
                    >
                      <X size={14} />
                    </button>
                  </div>


                  {searchResults.length === 0 ? (
                    <div className="no-results">
                      No complaints found.
                    </div>
                  ) : (
                    searchResults.map((item) => (
                      <button
                        className="search-result"
                        key={item.complaint_id}
                        onClick={() => openComplaint(item.complaint_id)}
                      >
                        <div>
                          <strong>
                            #{item.complaint_id} ·{" "}
                            {item.customer_name || "Unknown customer"}
                          </strong>

                          <span>
                            {item.product_name || "No product"} · Batch{" "}
                            {item.batch_lot_number || "—"}
                          </span>
                        </div>

                        <small>
                          {item.complaint_type || "Complaint"}
                        </small>
                      </button>
                    ))
                  )}

                </div>
              )}
            </div>


            {/* CONVERSATION */}

            <div className="messages">
              {messages.length === 0 && (
                <div className="welcome">
                  <Bot size={16} />

                  <span>
                    Upload a complaint file or type/paste the complaint here.
                    I will extract the details, assess risk and update the form.
                  </span>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  className={`message ${message.role}`}
                  key={index}
                >
                  <div className="message-bubble">
                    {message.text}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message assistant">
                  <div className="message-bubble typing">
                    AI is processing...
                  </div>
                </div>
              )}
            </div>


            {/* CHAT INPUT */}

            <div className="chat-input">
              <button
                className="attach-btn"
                title="Attach complaint file"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
              >
                <Paperclip size={18} />
              </button>

              <input
                value={chat}
                onChange={(event) => setChat(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleChat();
                }}
                placeholder="Type a message or paste complaint text..."
                disabled={loading}
              />

              <button
                className="send-btn"
                disabled={!chat.trim() || loading}
                onClick={handleChat}
              >
                <Send size={17} />
              </button>

              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".pdf,.docx,.txt,.eml,.png,.jpg,.jpeg,.bmp,.webp"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </div>


            {error && (
              <div className="error">
                <XCircle size={14} />
                {error}
              </div>
            )}

            <div className="disclaimer">
              AI responses may contain errors. Please verify information.
            </div>
          </section>

        </div>


        {/* ================= FULL WIDTH SUMMARY ================= */}

        <section className="summary-panel">
          <div className="summary-panel-header">
            <div className="summary-title">
              <div className="summary-icon">
                <FileText size={18} />
              </div>

              <div>
                <div className="eyebrow">SESSION SUMMARY</div>
                <h2>Detailed Complaint Summary</h2>

                <p>
                  Combined view of the complaint form and the complete chatbot
                  conversation.
                </p>
              </div>
            </div>

            <div className="summary-meta">
              <span>{messages.length} conversation messages</span>
              <span>{completenessPercentage}% complete</span>
            </div>
          </div>


          <div className="summary-content">
            {summary ? (
              <p>{summary}</p>
            ) : (
              <p className="summary-empty">
                The detailed AI summary will appear here after complaint
                information is provided or a complaint is loaded from
                PostgreSQL.
              </p>
            )}
          </div>
        </section>
      </main>


      {/* ================= CONFIRM SUBMIT ================= */}

      {confirmOpen && (
        <Modal
          title="Confirm Submission"
          icon={<ShieldCheck size={22} />}
          text="Are you sure you want to submit this complaint? It will be saved to PostgreSQL."
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirmSubmit}
          confirmText="Submit Complaint"
        />
      )}


      {/* ================= DUPLICATE ================= */}

      {duplicateOpen && (
        <Modal
          title="Duplicate Complaint"
          icon={<AlertTriangle size={22} />}
          danger
          text={
            dbResult?.message ||
            "A duplicate complaint was found. The form and conversation have been kept unchanged so you can continue editing the original entry."
          }
          onCancel={() => setDuplicateOpen(false)}
          onConfirm={() => setDuplicateOpen(false)}
          confirmText="Continue Editing"
        />
      )}


      {/* ================= SUCCESS ================= */}

      {successOpen && (
        <Modal
          title="Complaint Submitted"
          icon={<CheckCircle2 size={22} />}
          success
          text={`Complaint ${
            dbResult?.complaint_id ?? ""
          } has been saved successfully. You can download the completed form.`}
          onCancel={() => setSuccessOpen(false)}
          onConfirm={() => {
            setSuccessOpen(false);
            downloadForm();
          }}
          confirmText="Download Form"
        />
      )}
    </div>
  );
}


function Section({ title, children }) {
  return (
    <>
      <div className="section-title">{title}</div>
      {children}
    </>
  );
}


function Field({
  keyName,
  label,
  value,
  changed,
  onChange,
  textarea = false,
  full = false,
}) {
  return (
    <label className={`field ${changed ? "changed" : ""} ${full ? "full" : ""}`}>
      <span>{label}</span>

      {textarea ? (
        <textarea
          value={value || ""}
          placeholder="Awaiting AI extraction..."
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type={keyName.includes("date") ? "date" : "text"}
          value={value || ""}
          placeholder="Awaiting AI extraction..."
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}


function Modal({
  title,
  text,
  icon,
  danger = false,
  success = false,
  onCancel,
  onConfirm,
  confirmText,
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button
          className="modal-close"
          onClick={onCancel}
        >
          <X size={17} />
        </button>

        <div className={`modal-icon ${danger ? "danger" : success ? "success" : ""}`}>
          {icon}
        </div>

        <h3>{title}</h3>
        <p>{text}</p>

        <div className="modal-actions">
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>

          <button
            className={`modal-confirm ${danger ? "danger-btn" : ""}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}


ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <App />
  </Provider>
);