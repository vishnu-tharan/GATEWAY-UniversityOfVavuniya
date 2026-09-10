import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
export async function saveReport({ items, faculty }) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(18);
  doc.text("University of Vavuniya - Gateway", 14, 18);
  doc.setFontSize(10);
  doc.text(
    `${faculty || "Campus"} | ${items.length} movements | Generated ${new Date().toLocaleString()}`,
    14,
    27,
  );
  autoTable(doc, {
    startY: 34,
    head: [
      [
        "Vehicle / Pass",
        "Driver",
        "Faculty",
        "Arrival / Gate",
        "Departure / Gate",
        "Approval",
      ],
    ],
    body: items.map((r) => [
      r.vehicleNumber + "\n" + (r.gatePassNumber || r.passId),
      r.driverName,
      r.faculty,
      new Date(r.inTime).toLocaleString() + "\n" + r.entryGate,
      r.outTime
        ? new Date(r.outTime).toLocaleString() + "\n" + r.exitGate
        : "Inside",
      r.approvalStatus,
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [23, 104, 91] },
    margin: { bottom: 20 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.text(
        "Confidential university operations report - authorized personnel only",
        14,
        doc.internal.pageSize.height - 10,
      );
    },
  });
  doc.save(`Gateway-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
