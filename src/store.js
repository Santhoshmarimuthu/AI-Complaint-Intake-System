import {
  configureStore,
  createSlice,
} from "@reduxjs/toolkit";


export const emptyComplaint = {
  complaint_source: "",
  customer_name: "",
  product_name: "",
  product_strength_grade: "",
  batch_lot_number: "",
  manufacturing_date: "",
  expiry_date: "",
  quantity_affected: "",
  complaint_type: "",
  complaint_date: "",
  detailed_complaint_description: "",
  initial_severity: "",
  priority: "",
};


const initialRisk = {
  level: "Unknown",
  reason:
    "No complaint information has been provided yet.",
};


const initialCompleteness = {
  percentage: 0,
  missing_fields: Object.keys(
    emptyComplaint
  ).filter(
    (field) =>
      field !== "initial_severity" &&
      field !== "priority"
  ),
};


const complaintSlice = createSlice({
  name: "complaint",

  initialState: {
    sessionId: null,
    complaint: {
      ...emptyComplaint,
    },
    changedFields: {},
    messages: [],
    loading: false,
    submitted: false,
    error: null,
    dbResult: null,
    riskAssessment: initialRisk,
    completeness: initialCompleteness,
    summary: "",
  },

  reducers: {
    setResult(state, action) {
      const nextComplaint = {
        ...emptyComplaint,
        ...(action.payload.json || {}),
      };

      const changed = {};

      Object.keys(nextComplaint).forEach(
        (field) => {
          const oldValue =
            state.complaint[field] || "";

          const newValue =
            nextComplaint[field] || "";

          if (
            oldValue &&
            oldValue !== newValue
          ) {
            changed[field] = true;
          }
        }
      );

      state.sessionId =
        action.payload.session_id ??
        state.sessionId;

      state.complaint = nextComplaint;
      state.changedFields = changed;

      if (action.payload.reply) {
        state.messages.push({
          role: "assistant",
          text: action.payload.reply,
        });
      }

      state.riskAssessment =
        action.payload.risk_assessment ||
        state.riskAssessment;

      state.completeness =
        action.payload.completeness ||
        state.completeness;

      state.summary =
        action.payload.complaint_summary ||
        state.summary;

      state.loading = false;
      state.error = null;
    },

    addUserMessage(state, action) {
      state.messages.push({
        role: "user",
        text: action.payload,
      });
    },

    updateField(state, action) {
      const {
        field,
        value,
      } = action.payload;

      state.complaint[field] = value;
      state.changedFields[field] = true;
    },

    setLoading(state, action) {
      state.loading = action.payload;
    },

    setError(state, action) {
      state.error = action.payload;
      state.loading = false;
    },

    setSubmitted(state, action) {
      state.submitted = action.payload;
    },

    setDbResult(state, action) {
      state.dbResult = action.payload;
    },

    resetFormOnly(state) {
      state.sessionId = null;
      state.complaint = {
        ...emptyComplaint,
      };
      state.changedFields = {};
      state.loading = false;
      state.submitted = false;
      state.error = null;
      state.dbResult = null;
      state.riskAssessment = initialRisk;
      state.completeness =
        initialCompleteness;
      state.summary = "";

      // Conversation intentionally remains.
    },

    resetAll(state) {
      state.sessionId = null;
      state.complaint = {
        ...emptyComplaint,
      };
      state.changedFields = {};
      state.messages = [];
      state.loading = false;
      state.submitted = false;
      state.error = null;
      state.dbResult = null;
      state.riskAssessment = initialRisk;
      state.completeness =
        initialCompleteness;
      state.summary = "";
    },
  },
});


export const {
  setResult,
  addUserMessage,
  updateField,
  setLoading,
  setError,
  setSubmitted,
  setDbResult,
  resetFormOnly,
  resetAll,
} = complaintSlice.actions;


export const store = configureStore({
  reducer: {
    complaint: complaintSlice.reducer,
  },
});
