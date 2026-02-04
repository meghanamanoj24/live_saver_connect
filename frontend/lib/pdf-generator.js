export async function generatePledgeReport(data) {
    try {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // --- Official Background ---
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, "F");

        // Border
        doc.setDrawColor(233, 30, 99);
        doc.setLineWidth(1);
        doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2), "S");

        // --- Header ---
        doc.setFillColor(26, 26, 46); // Dark primary
        doc.rect(margin, margin, pageWidth - (margin * 2), 40, "F");

        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("LIFESAVER CONNECT", margin + 10, margin + 20);

        doc.setFontSize(14);
        doc.setTextColor(233, 30, 99); // Pink
        doc.text("OFFICIAL ORGAN DONATION PLEDGE", margin + 10, margin + 30);

        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(`Pledge ID: #${data.id || "PENDING"}`, pageWidth - margin - 10, margin + 20, { align: "right" });
        doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin - 10, margin + 30, { align: "right" });

        let yPos = margin + 55;

        // --- Donor Details ---
        doc.setFontSize(16);
        doc.setTextColor(26, 26, 46);
        doc.setFont("helvetica", "bold");
        doc.text("I. DONOR INFORMATION", margin + 10, yPos);

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin + 10, yPos + 3, pageWidth - margin - 10, yPos + 3);

        yPos += 15;
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);

        // Safely access nested properties
        const user = data.user || {};
        const details = [
            { label: "Name", value: `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A" },
            { label: "Email", value: user.email || "N/A" },
            { label: "Blood Group", value: data.blood_group || "N/A" },
            { label: "Date of Birth", value: data.date_of_birth || "N/A" },
            { label: "Phone", value: data.phone || "N/A" },
            { label: "Address", value: doc.splitTextToSize(data.address || "N/A", 100) },
            { label: "Health Cert", value: data.health_certificate ? "Verified/Attached" : "Self-Declared" },
            {
                label: "Consents", value: [
                    data.post_mortem_consent ? "✓ Post-Mortem Consent" : "✗ No Post-Mortem Consent",
                    data.family_responsibility ? "✓ Family Informed" : "✗ Family Not Informed"
                ]
            },
        ];

        details.forEach(item => {
            doc.setFont("helvetica", "bold");
            doc.text(`${item.label}:`, margin + 15, yPos);
            doc.setFont("helvetica", "normal");
            if (Array.isArray(item.value)) {
                doc.text(item.value, margin + 60, yPos);
                yPos += (item.value.length * 6) + 4;
            } else {
                doc.text(item.value, margin + 60, yPos);
                yPos += 8;
            }
        });

        yPos += 10;
        // --- Emergency Contact ---
        doc.setFontSize(16);
        doc.setTextColor(26, 26, 46);
        doc.setFont("helvetica", "bold");
        doc.text("II. EMERGENCY CONTACT", margin + 10, yPos);
        doc.line(margin + 10, yPos + 3, pageWidth - margin - 10, yPos + 3);

        yPos += 15;
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");

        doc.setFont("helvetica", "bold");
        doc.text("Name:", margin + 15, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(data.emergency_contact_name || "N/A", margin + 60, yPos);

        yPos += 8;
        doc.setFont("helvetica", "bold");
        doc.text("Phone:", margin + 15, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(data.emergency_contact_phone || "N/A", margin + 60, yPos);

        yPos += 8;
        doc.setFont("helvetica", "bold");
        doc.text("Relation:", margin + 15, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(data.emergency_contact_relation || "N/A", margin + 60, yPos);


        yPos += 20;
        // --- Pledge Details ---
        doc.setFontSize(16);
        doc.setTextColor(26, 26, 46);
        doc.setFont("helvetica", "bold");
        doc.text("III. PLEDGE COMMITMENT", margin + 10, yPos);
        doc.line(margin + 10, yPos + 3, pageWidth - margin - 10, yPos + 3);

        yPos += 15;
        doc.setFillColor(233, 30, 99, 0.1); // Light pink
        doc.setDrawColor(233, 30, 99);
        doc.roundedRect(margin + 10, yPos - 5, pageWidth - (margin * 2) - 20, 30, 2, 2, "FD");

        doc.setFontSize(12);
        doc.setTextColor(233, 30, 99);
        doc.text("Organs Pledged:", margin + 20, yPos + 5);

        const organsList = data.organs || (Array.isArray(data.organs_to_donate) ? data.organs_to_donate.join(", ") : "N/A");
        doc.setFontSize(14);
        doc.setTextColor(26, 26, 46);
        doc.text(organsList, margin + 20, yPos + 15);

        yPos += 30;
        // --- Commitment Details (If Accepted) ---
        if (data.status && data.status !== "PENDING") {
            doc.setFontSize(14);
            doc.setTextColor(data.status === "COMMITTED" ? "#22C55E" : "#E91E63");
            doc.setFont("helvetica", "bold");
            doc.text(`STATUS: ${data.status.replace("_", " ")}`, margin + 10, yPos);

            yPos += 8;
            if (data.accepted_by_hospital_name) {
                doc.setFontSize(11);
                doc.setTextColor(60, 60, 60);
                doc.setFont("helvetica", "normal");
                doc.text(`Accepted by: ${data.accepted_by_hospital_name}`, margin + 10, yPos);
                yPos += 7;
            }

            if (data.hospital_message) {
                doc.setFontSize(10);
                doc.setFont("helvetica", "italic");
                const msg = doc.splitTextToSize(`Hospital Message: "${data.hospital_message}"`, pageWidth - (margin * 2) - 20);
                doc.text(msg, margin + 10, yPos);
                yPos += (msg.length * 5) + 5;
            }
        }

        yPos += 40;
        // --- Declaration ---
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        const declaration = "I hereby pledge to donate my organs after my death for therapeutic purposes. I understand that this pledge is voluntary and can be withdrawn at any time. I have informed my family about this decision.";
        const splitDec = doc.splitTextToSize(declaration, pageWidth - (margin * 2) - 20);
        doc.text(splitDec, margin + 10, yPos);

        // --- Signatures ---
        const sealY = pageHeight - margin - 50;

        // Seal
        const sealX = pageWidth - margin - 40;
        doc.setDrawColor(233, 30, 99);
        doc.setLineWidth(1.5);
        doc.circle(sealX, sealY, 18, "S");
        doc.circle(sealX, sealY, 16, "S");
        doc.setFontSize(8);
        doc.setTextColor(233, 30, 99);
        doc.setFont("helvetica", "bold");
        doc.text("LIFESAVER", sealX, sealY - 8, { align: "center" });
        doc.text("REGISTERED", sealX, sealY + 10, { align: "center" });
        doc.setFontSize(6);
        doc.text("VERIFIED PLEDGE", sealX, sealY, { align: "center" });

        // Donor Sig
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(margin + 10, sealY + 10, margin + 70, sealY + 10);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text("Donor Signature", margin + 40, sealY + 16, { align: "center" });

        doc.save(data.title || "Organ_Donation_Pledge_Report.pdf");

    } catch (err) {
        console.error(err);
        alert("Error generating report. Please try again.");
    }
}
