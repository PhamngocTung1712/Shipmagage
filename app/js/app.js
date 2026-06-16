/**
 * Main Application Logic V2.0
 */

const app = {
    currentView: 'dashboard',
    selectedDebtCustomer: '',
    excludeDockingDepreciation: localStorage.getItem('exclude_docking_depreciation') === 'true',

    toggleExcludeDockingDepreciation(checked) {
        this.excludeDockingDepreciation = checked;
        localStorage.setItem('exclude_docking_depreciation', checked ? 'true' : 'false');
        this.navigate(this.currentView, ...this.currentViewArgs || []);
    },

    exportDocumentedSalaryExcel() {
        const month = document.getElementById('sal-month')?.value || new Date().toISOString().substring(0, 7);
        const [year, monthNum] = month.split('-');
        
        const calcTax = (income) => {
            if (income <= 0) return 0;
            if (income <= 5000000) return income * 0.05;
            if (income <= 10000000) return (5000000 * 0.05) + ((income - 5000000) * 0.1);
            if (income <= 18000000) return (5000000 * 0.05) + (5000000 * 0.1) + ((income - 10000000) * 0.15);
            if (income <= 32000000) return (5000000 * 0.05) + (5000000 * 0.1) + (8000000 * 0.15) + ((income - 18000000) * 0.2);
            if (income <= 52000000) return (5000000 * 0.05) + (5000000 * 0.1) + (8000000 * 0.15) + (14000000 * 0.2) + ((income - 32000000) * 0.25);
            if (income <= 80000000) return (5000000 * 0.05) + (5000000 * 0.1) + (8000000 * 0.15) + (14000000 * 0.2) + (20000000 * 0.25) + ((income - 52000000) * 0.3);
            return (5000000 * 0.05) + (5000000 * 0.1) + (8000000 * 0.15) + (14000000 * 0.2) + (20000000 * 0.25) + (28000000 * 0.3) + ((income - 80000000) * 0.35);
        };

        const numCell = (val) => {
            if (!val) return '<td style="text-align: right; mso-number-format:\'\\#\\,\\#\\#0\';" x:num="0">0</td>';
            return `<td style="text-align: right; mso-number-format:\'\\#\\,\\#\\#0\';" x:num="${val}">${val}</td>`;
        };

        const boldNumCell = (val) => {
            if (!val) return '<td style="text-align: right; font-weight: bold; mso-number-format:\'\\#\\,\\#\\#0\';" x:num="0">0</td>';
            return `<td style="text-align: right; font-weight: bold; mso-number-format:\'\\#\\,\\#\\#0\';" x:num="${val}">${val}</td>`;
        };

        const formulaCell = (formula, val) => {
            return `<td style="text-align: right; mso-number-format:\'\\#\\,\\#\\#0\';" x:num="${val}" x:fmla="=${formula}">${val}</td>`;
        };

        const boldFormulaCell = (formula, val) => {
            return `<td style="text-align: right; font-weight: bold; mso-number-format:\'\\#\\,\\#\\#0\';" x:num="${val}" x:fmla="=${formula}">${val}</td>`;
        };

        const centerCell = (val) => {
            if (typeof val === 'number') {
                return `<td style="text-align: center;" x:num="${val}">${val}</td>`;
            }
            return `<td style="text-align: center;">${val !== undefined ? val : ''}</td>`;
        };

        const boldCenterCell = (val) => {
            if (typeof val === 'number') {
                return `<td style="text-align: center; font-weight: bold;" x:num="${val}">${val}</td>`;
            }
            return `<td style="text-align: center; font-weight: bold;">${val !== undefined ? val : ''}</td>`;
        };

        const boldCenterFormulaCell = (formula, val) => {
            return `<td style="text-align: center; font-weight: bold;" x:num="${val}" x:fmla="=${formula}">${val}</td>`;
        };

        const sumSelectedRowsFormula = (colLetter, rowIndices) => {
            if (!rowIndices || rowIndices.length === 0) return '0';
            return rowIndices.map(r => `${colLetter}${r}`).join('+');
        };

        const employees = AppData.getEmployees();
        const vessels = AppData.getVessels();

        // 1. Group VP (Management)
        const vpEmployees = employees.filter(e => AppData.getEmployeeActiveState(e, month).department === 'VP');
        // 2. Group Exploitation (Vessels)
        const vesselGroups = vessels.map(v => {
            return {
                vessel: v,
                employees: employees.filter(e => AppData.getEmployeeActiveState(e, month).department === v.id)
            };
        }).filter(g => g.employees.length > 0);

        // We will collect grand totals
        let grandBasic = 0, grandMeal = 0, grandPhone = 0, grandClothing = 0, grandTransport = 0, grandDelivery = 0, grandBonus = 0;
        let grandActualTotal = 0, grandTaxable = 0, grandPersonal = 0, grandDependents = 0, grandDepDeduction = 0, grandInsuranceBase = 0;
        let grandDnBhxh = 0, grandDnBhyt = 0, grandDnBhtn = 0, grandDnTotal = 0;
        let grandNvBhxh = 0, grandNvBhyt = 0, grandNvBhtn = 0, grandNvTotal = 0;
        let grandAssessable = 0, grandTax = 0, grandRemaining = 0;

        let rowsHTML = '';
        let stt = 1;
        let currentRow = 6;

        // Helper to process a list of employees for a department
        const processGroup = (groupEmployees, depId, groupName) => {
            let subBasic = 0, subMeal = 0, subPhone = 0, subClothing = 0, subTransport = 0, subDelivery = 0, subBonus = 0;
            let subActualTotal = 0, subTaxable = 0, subPersonal = 0, subDependents = 0, subDepDeduction = 0, subInsuranceBase = 0;
            let subDnBhxh = 0, subDnBhyt = 0, subDnBhtn = 0, subDnTotal = 0;
            let subNvBhxh = 0, subNvBhyt = 0, subNvBhtn = 0, subNvTotal = 0;
            let subAssessable = 0, subTax = 0, subRemaining = 0;

            const timesheet = AppData.getTimesheet(month, depId) || {};
            const voyageCount = Number(timesheet.voyageCount) || 0;
            const depRate = timesheet.dependentDeductionRate !== undefined ? timesheet.dependentDeductionRate : 4400000;

            let groupRows = '';
            let groupStartRow = currentRow;
            groupEmployees.forEach(e => {
                const ov = (timesheet.salaryOverrides && timesheet.salaryOverrides[e.id]) || {};
                const activeState = AppData.getEmployeeActiveState(e, month);

                const basic = ov.basicSalary !== undefined ? Number(ov.basicSalary) : (Number(activeState.basicSalary) || 0);
                const meal = ov.mealAllowance !== undefined ? Number(ov.mealAllowance) : (Number(activeState.mealAllowance) || 0);
                const phone = ov.phoneAllowance !== undefined ? Number(ov.phoneAllowance) : (Number(activeState.phoneAllowance) || 0);
                const clothing = ov.clothingAllowance !== undefined ? Number(ov.clothingAllowance) : (Number(activeState.clothingAllowance) || 0);
                const transport = ov.transportAllowance !== undefined ? Number(ov.transportAllowance) : (Number(activeState.transportAllowance) || 0);
                const delivery = ov.deliveryAllowance !== undefined ? Number(ov.deliveryAllowance) : (Number(activeState.deliveryAllowance) || 0) * voyageCount;
                const bonus = ov.completionBonus !== undefined ? Number(ov.completionBonus) : (Number(activeState.completionBonus) || 0) * voyageCount;

                const actualTotal = basic + meal + phone + clothing + transport + delivery + bonus;
                const taxableIncome = Math.max(0, actualTotal - meal - phone - clothing);
                
                const personalDeduction = ov.personalDeduction !== undefined ? Number(ov.personalDeduction) : (Number(activeState.personalDeduction) || 15500000);
                const dependents = ov.dependents !== undefined ? Number(ov.dependents) : (Number(activeState.dependents) || 0);
                const dependentDeduction = dependents * depRate;

                const insuranceBase = ov.insurance !== undefined ? Number(ov.insurance) : (activeState.insurance !== undefined && activeState.insurance !== null ? Number(activeState.insurance) : basic);

                const dnBhxh = insuranceBase * 0.175;
                const dnBhyt = insuranceBase * 0.03;
                const dnBhtn = insuranceBase * 0.01;
                const dnTotal = dnBhxh + dnBhyt + dnBhtn;

                const nvBhxh = insuranceBase * 0.08;
                const nvBhyt = insuranceBase * 0.015;
                const nvBhtn = insuranceBase * 0.01;
                const nvTotal = nvBhxh + nvBhyt + nvBhtn;

                const assessableIncome = Math.max(0, taxableIncome - personalDeduction - dependentDeduction - nvTotal);
                const tax = calcTax(assessableIncome);
                const remaining = actualTotal - nvTotal - tax;

                subBasic += basic;
                subMeal += meal;
                subPhone += phone;
                subClothing += clothing;
                subTransport += transport;
                subDelivery += delivery;
                subBonus += bonus;
                subActualTotal += actualTotal;
                subTaxable += taxableIncome;
                subPersonal += personalDeduction;
                subDependents += dependents;
                subDepDeduction += dependentDeduction;
                subInsuranceBase += insuranceBase;
                subDnBhxh += dnBhxh;
                subDnBhyt += dnBhyt;
                subDnBhtn += dnBhtn;
                subDnTotal += dnTotal;
                subNvBhxh += nvBhxh;
                subNvBhyt += nvBhyt;
                subNvBhtn += nvBhtn;
                subNvTotal += nvTotal;
                subAssessable += assessableIncome;
                subTax += tax;
                subRemaining += remaining;

                groupRows += `
                    <tr style="height: 25px;">
                        <td style="text-align: center;">${stt++}</td>
                        <td>${e.name}</td>
                        <td>${e.role || ''}</td>
                        ${numCell(basic)}
                        ${numCell(meal)}
                        ${numCell(phone)}
                        ${numCell(clothing)}
                        ${numCell(transport)}
                        ${numCell(delivery)}
                        ${numCell(bonus)}
                        ${formulaCell(`SUM(D${currentRow}:J${currentRow})`, actualTotal)}
                        ${formulaCell(`MAX(0,K${currentRow}-E${currentRow}-F${currentRow}-G${currentRow})`, taxableIncome)}
                        ${numCell(personalDeduction)}
                        ${centerCell(dependents)}
                        ${formulaCell(`N${currentRow}*${depRate}`, dependentDeduction)}
                        ${ov.insurance !== undefined || (e.insurance !== undefined && e.insurance !== null) ? numCell(insuranceBase) : formulaCell(`D${currentRow}`, insuranceBase)}
                        ${formulaCell(`P${currentRow}*0.175`, dnBhxh)}
                        ${formulaCell(`P${currentRow}*0.03`, dnBhyt)}
                        ${formulaCell(`P${currentRow}*0.01`, dnBhtn)}
                        ${formulaCell(`SUM(Q${currentRow}:S${currentRow})`, dnTotal)}
                        ${formulaCell(`P${currentRow}*0.08`, nvBhxh)}
                        ${formulaCell(`P${currentRow}*0.015`, nvBhyt)}
                        ${formulaCell(`P${currentRow}*0.01`, nvBhtn)}
                        ${formulaCell(`SUM(U${currentRow}:W${currentRow})`, nvTotal)}
                        ${formulaCell(`MAX(0,L${currentRow}-M${currentRow}-O${currentRow}-X${currentRow})`, assessableIncome)}
                        ${formulaCell(`IF(Y${currentRow}<=0,0,IF(Y${currentRow}<=5000000,Y${currentRow}*0.05,IF(Y${currentRow}<=10000000,Y${currentRow}*0.1-250000,IF(Y${currentRow}<=18000000,Y${currentRow}*0.15-750000,IF(Y${currentRow}<=32000000,Y${currentRow}*0.2-1650000,IF(Y${currentRow}<=52000000,Y${currentRow}*0.25-3250000,IF(Y${currentRow}<=80000000,Y${currentRow}*0.3-5850000,Y${currentRow}*0.35-9850000)))))))`, tax)}
                        ${formulaCell(`K${currentRow}-X${currentRow}-Z${currentRow}`, remaining)}
                    </tr>
                `;
                currentRow++;
            });

            let groupEndRow = currentRow - 1;
            let summaryRowIndex = currentRow;

            // Group summary row
            groupRows += `
                <tr style="font-weight: bold; background-color: #e6f2ff; height: 28px;">
                    <td colspan="3" style="text-align: center; font-weight: bold;">TỔNG CỘNG ${groupName.toUpperCase()}</td>
                    ${boldFormulaCell(`SUM(D${groupStartRow}:D${groupEndRow})`, subBasic)}
                    ${boldFormulaCell(`SUM(E${groupStartRow}:E${groupEndRow})`, subMeal)}
                    ${boldFormulaCell(`SUM(F${groupStartRow}:F${groupEndRow})`, subPhone)}
                    ${boldFormulaCell(`SUM(G${groupStartRow}:G${groupEndRow})`, subClothing)}
                    ${boldFormulaCell(`SUM(H${groupStartRow}:H${groupEndRow})`, subTransport)}
                    ${boldFormulaCell(`SUM(I${groupStartRow}:I${groupEndRow})`, subDelivery)}
                    ${boldFormulaCell(`SUM(J${groupStartRow}:J${groupEndRow})`, subBonus)}
                    ${boldFormulaCell(`SUM(K${groupStartRow}:K${groupEndRow})`, subActualTotal)}
                    ${boldFormulaCell(`SUM(L${groupStartRow}:L${groupEndRow})`, subTaxable)}
                    ${boldFormulaCell(`SUM(M${groupStartRow}:M${groupEndRow})`, subPersonal)}
                    ${boldCenterFormulaCell(`SUM(N${groupStartRow}:N${groupEndRow})`, subDependents)}
                    ${boldFormulaCell(`SUM(O${groupStartRow}:O${groupEndRow})`, subDepDeduction)}
                    ${boldFormulaCell(`SUM(P${groupStartRow}:P${groupEndRow})`, subInsuranceBase)}
                    ${boldFormulaCell(`SUM(Q${groupStartRow}:Q${groupEndRow})`, subDnBhxh)}
                    ${boldFormulaCell(`SUM(R${groupStartRow}:R${groupEndRow})`, subDnBhyt)}
                    ${boldFormulaCell(`SUM(S${groupStartRow}:S${groupEndRow})`, subDnBhtn)}
                    ${boldFormulaCell(`SUM(T${groupStartRow}:T${groupEndRow})`, subDnTotal)}
                    ${boldFormulaCell(`SUM(U${groupStartRow}:U${groupEndRow})`, subNvBhxh)}
                    ${boldFormulaCell(`SUM(V${groupStartRow}:V${groupEndRow})`, subNvBhyt)}
                    ${boldFormulaCell(`SUM(W${groupStartRow}:W${groupEndRow})`, subNvBhtn)}
                    ${boldFormulaCell(`SUM(X${groupStartRow}:X${groupEndRow})`, subNvTotal)}
                    ${boldFormulaCell(`SUM(Y${groupStartRow}:Y${groupEndRow})`, subAssessable)}
                    ${boldFormulaCell(`SUM(Z${groupStartRow}:Z${groupEndRow})`, subTax)}
                    ${boldFormulaCell(`SUM(AA${groupStartRow}:AA${groupEndRow})`, subRemaining)}
                </tr>
            `;
            currentRow++;

            return {
                html: groupRows,
                summaryRowIndex: summaryRowIndex,
                sums: {
                    basic: subBasic, meal: subMeal, phone: subPhone, clothing: subClothing, transport: subTransport,
                    delivery: subDelivery, bonus: subBonus, actualTotal: subActualTotal, taxable: subTaxable,
                    personal: subPersonal, dependents: subDependents, depDeduction: subDepDeduction,
                    insuranceBase: subInsuranceBase, dnBhxh: subDnBhxh, dnBhyt: subDnBhyt, dnBhtn: subDnBhtn, dnTotal: subDnTotal,
                    nvBhxh: subNvBhxh, nvBhyt: subNvBhyt, nvBhtn: subNvBhtn, nvTotal: subNvTotal,
                    assessable: subAssessable, tax: subTax, remaining: subRemaining
                }
            };
        };

        let vpSummaryRowIndex = null;
        // Render VP Group
        if (vpEmployees.length > 0) {
            rowsHTML += `
                <tr style="height: 25px; font-weight: bold; background-color: #d9d9d9;">
                    <td colspan="27" style="font-weight: bold;">I. BỘ PHẬN QUẢN LÝ</td>
                </tr>
            `;
            currentRow++; // Advance 1 for title
            const res = processGroup(vpEmployees, 'VP', 'BỘ PHẬN QUẢN LÝ');
            rowsHTML += res.html;
            vpSummaryRowIndex = res.summaryRowIndex;
            
            // Add to grand totals
            grandBasic += res.sums.basic; grandMeal += res.sums.meal; grandPhone += res.sums.phone;
            grandClothing += res.sums.clothing; grandTransport += res.sums.transport;
            grandDelivery += res.sums.delivery; grandBonus += res.sums.bonus;
            grandActualTotal += res.sums.actualTotal; grandTaxable += res.sums.taxable;
            grandPersonal += res.sums.personal; grandDependents += res.sums.dependents;
            grandDepDeduction += res.sums.depDeduction; grandInsuranceBase += res.sums.insuranceBase;
            grandDnBhxh += res.sums.dnBhxh; grandDnBhyt += res.sums.dnBhyt; grandDnBhtn += res.sums.dnBhtn; grandDnTotal += res.sums.dnTotal;
            grandNvBhxh += res.sums.nvBhxh; grandNvBhyt += res.sums.nvBhyt; grandNvBhtn += res.sums.nvBhtn; grandNvTotal += res.sums.nvTotal;
            grandAssessable += res.sums.assessable; grandTax += res.sums.tax; grandRemaining += res.sums.remaining;
        }

        // Render Exploitation Group
        const vesselSummaryRowIndices = [];
        let expSummaryRowIndex = null;

        let expBasic = 0, expMeal = 0, expPhone = 0, expClothing = 0, expTransport = 0, expDelivery = 0, expBonus = 0;
        let expActualTotal = 0, expTaxable = 0, expPersonal = 0, expDependents = 0, expDepDeduction = 0, expInsuranceBase = 0;
        let expDnBhxh = 0, expDnBhyt = 0, expDnBhtn = 0, expDnTotal = 0;
        let expNvBhxh = 0, expNvBhyt = 0, expNvBhtn = 0, expNvTotal = 0;
        let expAssessable = 0, expTax = 0, expRemaining = 0;

        if (vesselGroups.length > 0) {
            rowsHTML += `
                <tr style="height: 25px; font-weight: bold; background-color: #d9d9d9;">
                    <td colspan="27" style="font-weight: bold;">II. BỘ PHẬN KHAI THÁC (CÁC TÀU)</td>
                </tr>
            `;
            currentRow++; // Advance 1 for section title

            vesselGroups.forEach(g => {
                rowsHTML += `
                    <tr style="height: 25px; font-weight: bold; background-color: #f2f2f2;">
                        <td colspan="27" style="font-weight: bold; padding-left: 20px;">Tàu ${g.vessel.name}</td>
                    </tr>
                `;
                currentRow++; // Advance 1 for vessel title row
                
                const res = processGroup(g.employees, g.vessel.id, `TÀU ${g.vessel.name}`);
                rowsHTML += res.html;
                vesselSummaryRowIndices.push(res.summaryRowIndex);

                expBasic += res.sums.basic; expMeal += res.sums.meal; expPhone += res.sums.phone;
                expClothing += res.sums.clothing; expTransport += res.sums.transport;
                expDelivery += res.sums.delivery; expBonus += res.sums.bonus;
                expActualTotal += res.sums.actualTotal; expTaxable += res.sums.taxable;
                expPersonal += res.sums.personal; expDependents += res.sums.dependents;
                expDepDeduction += res.sums.depDeduction; expInsuranceBase += res.sums.insuranceBase;
                expDnBhxh += res.sums.dnBhxh; expDnBhyt += res.sums.dnBhyt; expDnBhtn += res.sums.dnBhtn; expDnTotal += res.sums.dnTotal;
                expNvBhxh += res.sums.nvBhxh; expNvBhyt += res.sums.nvBhyt; expNvBhtn += res.sums.nvBhtn; expNvTotal += res.sums.nvTotal;
                expAssessable += res.sums.assessable; expTax += res.sums.tax; expRemaining += res.sums.remaining;
            });

            expSummaryRowIndex = currentRow;

            const expBasicFormula = sumSelectedRowsFormula('D', vesselSummaryRowIndices);
            const expMealFormula = sumSelectedRowsFormula('E', vesselSummaryRowIndices);
            const expPhoneFormula = sumSelectedRowsFormula('F', vesselSummaryRowIndices);
            const expClothingFormula = sumSelectedRowsFormula('G', vesselSummaryRowIndices);
            const expTransportFormula = sumSelectedRowsFormula('H', vesselSummaryRowIndices);
            const expDeliveryFormula = sumSelectedRowsFormula('I', vesselSummaryRowIndices);
            const expBonusFormula = sumSelectedRowsFormula('J', vesselSummaryRowIndices);
            const expActualTotalFormula = sumSelectedRowsFormula('K', vesselSummaryRowIndices);
            const expTaxableFormula = sumSelectedRowsFormula('L', vesselSummaryRowIndices);
            const expPersonalFormula = sumSelectedRowsFormula('M', vesselSummaryRowIndices);
            const expDependentsFormula = sumSelectedRowsFormula('N', vesselSummaryRowIndices);
            const expDepDeductionFormula = sumSelectedRowsFormula('O', vesselSummaryRowIndices);
            const expInsuranceBaseFormula = sumSelectedRowsFormula('P', vesselSummaryRowIndices);
            const expDnBhxhFormula = sumSelectedRowsFormula('Q', vesselSummaryRowIndices);
            const expDnBhytFormula = sumSelectedRowsFormula('R', vesselSummaryRowIndices);
            const expDnBhtnFormula = sumSelectedRowsFormula('S', vesselSummaryRowIndices);
            const expDnTotalFormula = sumSelectedRowsFormula('T', vesselSummaryRowIndices);
            const expNvBhxhFormula = sumSelectedRowsFormula('U', vesselSummaryRowIndices);
            const expNvBhytFormula = sumSelectedRowsFormula('V', vesselSummaryRowIndices);
            const expNvBhtnFormula = sumSelectedRowsFormula('W', vesselSummaryRowIndices);
            const expNvTotalFormula = sumSelectedRowsFormula('X', vesselSummaryRowIndices);
            const expAssessableFormula = sumSelectedRowsFormula('Y', vesselSummaryRowIndices);
            const expTaxFormula = sumSelectedRowsFormula('Z', vesselSummaryRowIndices);
            const expRemainingFormula = sumSelectedRowsFormula('AA', vesselSummaryRowIndices);

            // Exploitation summary row
            rowsHTML += `
                <tr style="font-weight: bold; background-color: #d9ebd9; height: 30px;">
                    <td colspan="3" style="text-align: center; font-weight: bold;">TỔNG CỘNG BỘ PHẬN KHAI THÁC</td>
                    ${boldFormulaCell(expBasicFormula, expBasic)}
                    ${boldFormulaCell(expMealFormula, expMeal)}
                    ${boldFormulaCell(expPhoneFormula, expPhone)}
                    ${boldFormulaCell(expClothingFormula, expClothing)}
                    ${boldFormulaCell(expTransportFormula, expTransport)}
                    ${boldFormulaCell(expDeliveryFormula, expDelivery)}
                    ${boldFormulaCell(expBonusFormula, expBonus)}
                    ${boldFormulaCell(expActualTotalFormula, expActualTotal)}
                    ${boldFormulaCell(expTaxableFormula, expTaxable)}
                    ${boldFormulaCell(expPersonalFormula, expPersonal)}
                    ${boldCenterFormulaCell(expDependentsFormula, expDependents)}
                    ${boldFormulaCell(expDepDeductionFormula, expDepDeduction)}
                    ${boldFormulaCell(expInsuranceBaseFormula, expInsuranceBase)}
                    ${boldFormulaCell(expDnBhxhFormula, expDnBhxh)}
                    ${boldFormulaCell(expDnBhytFormula, expDnBhyt)}
                    ${boldFormulaCell(expDnBhtnFormula, expDnBhtn)}
                    ${boldFormulaCell(expDnTotalFormula, expDnTotal)}
                    ${boldFormulaCell(expNvBhxhFormula, expNvBhxh)}
                    ${boldFormulaCell(expNvBhytFormula, expNvBhyt)}
                    ${boldFormulaCell(expNvBhtnFormula, expNvBhtn)}
                    ${boldFormulaCell(expNvTotalFormula, expNvTotal)}
                    ${boldFormulaCell(expAssessableFormula, expAssessable)}
                    ${boldFormulaCell(expTaxFormula, expTax)}
                    ${boldFormulaCell(expRemainingFormula, expRemaining)}
                </tr>
            `;
            currentRow++;

            // Add to grand totals
            grandBasic += expBasic; grandMeal += expMeal; grandPhone += expPhone;
            grandClothing += expClothing; grandTransport += expTransport;
            grandDelivery += expDelivery; grandBonus += expBonus;
            grandActualTotal += expActualTotal; grandTaxable += expTaxable;
            grandPersonal += expPersonal; grandDependents += expDependents;
            grandDepDeduction += expDepDeduction; grandInsuranceBase += expInsuranceBase;
            grandDnBhxh += expDnBhxh; grandDnBhyt += expDnBhyt; grandDnBhtn += expDnBhtn; grandDnTotal += expDnTotal;
            grandNvBhxh += expNvBhxh; grandNvBhyt += expNvBhyt; grandNvBhtn += expNvBhtn; grandNvTotal += expNvTotal;
            grandAssessable += expAssessable; grandTax += expTax; grandRemaining += expRemaining;
        }

        // Grand totals row
        const grandTotalRowIndices = [];
        if (vpSummaryRowIndex !== null) grandTotalRowIndices.push(vpSummaryRowIndex);
        if (expSummaryRowIndex !== null) grandTotalRowIndices.push(expSummaryRowIndex);

        const grandBasicFormula = sumSelectedRowsFormula('D', grandTotalRowIndices);
        const grandMealFormula = sumSelectedRowsFormula('E', grandTotalRowIndices);
        const grandPhoneFormula = sumSelectedRowsFormula('F', grandTotalRowIndices);
        const grandClothingFormula = sumSelectedRowsFormula('G', grandTotalRowIndices);
        const grandTransportFormula = sumSelectedRowsFormula('H', grandTotalRowIndices);
        const grandDeliveryFormula = sumSelectedRowsFormula('I', grandTotalRowIndices);
        const grandBonusFormula = sumSelectedRowsFormula('J', grandTotalRowIndices);
        const grandActualTotalFormula = sumSelectedRowsFormula('K', grandTotalRowIndices);
        const grandTaxableFormula = sumSelectedRowsFormula('L', grandTotalRowIndices);
        const grandPersonalFormula = sumSelectedRowsFormula('M', grandTotalRowIndices);
        const grandDependentsFormula = sumSelectedRowsFormula('N', grandTotalRowIndices);
        const grandDepDeductionFormula = sumSelectedRowsFormula('O', grandTotalRowIndices);
        const grandInsuranceBaseFormula = sumSelectedRowsFormula('P', grandTotalRowIndices);
        const grandDnBhxhFormula = sumSelectedRowsFormula('Q', grandTotalRowIndices);
        const grandDnBhytFormula = sumSelectedRowsFormula('R', grandTotalRowIndices);
        const grandDnBhtnFormula = sumSelectedRowsFormula('S', grandTotalRowIndices);
        const grandDnTotalFormula = sumSelectedRowsFormula('T', grandTotalRowIndices);
        const grandNvBhxhFormula = sumSelectedRowsFormula('U', grandTotalRowIndices);
        const grandNvBhytFormula = sumSelectedRowsFormula('V', grandTotalRowIndices);
        const grandNvBhtnFormula = sumSelectedRowsFormula('W', grandTotalRowIndices);
        const grandNvTotalFormula = sumSelectedRowsFormula('X', grandTotalRowIndices);
        const grandAssessableFormula = sumSelectedRowsFormula('Y', grandTotalRowIndices);
        const grandTaxFormula = sumSelectedRowsFormula('Z', grandTotalRowIndices);
        const grandRemainingFormula = sumSelectedRowsFormula('AA', grandTotalRowIndices);

        rowsHTML += `
            <tr style="font-weight: bold; background-color: #ffd699; height: 32px;">
                <td colspan="3" style="text-align: center; font-weight: bold; text-transform: uppercase;">TỔNG CỘNG TOÀN CÔNG TY</td>
                ${boldFormulaCell(grandBasicFormula, grandBasic)}
                ${boldFormulaCell(grandMealFormula, grandMeal)}
                ${boldFormulaCell(grandPhoneFormula, grandPhone)}
                ${boldFormulaCell(grandClothingFormula, grandClothing)}
                ${boldFormulaCell(grandTransportFormula, grandTransport)}
                ${boldFormulaCell(grandDeliveryFormula, grandDelivery)}
                ${boldFormulaCell(grandBonusFormula, grandBonus)}
                ${boldFormulaCell(grandActualTotalFormula, grandActualTotal)}
                ${boldFormulaCell(grandTaxableFormula, grandTaxable)}
                ${boldFormulaCell(grandPersonalFormula, grandPersonal)}
                ${boldCenterFormulaCell(grandDependentsFormula, grandDependents)}
                ${boldFormulaCell(grandDepDeductionFormula, grandDepDeduction)}
                ${boldFormulaCell(grandInsuranceBaseFormula, grandInsuranceBase)}
                ${boldFormulaCell(grandDnBhxhFormula, grandDnBhxh)}
                ${boldFormulaCell(grandDnBhytFormula, grandDnBhyt)}
                ${boldFormulaCell(grandDnBhtnFormula, grandDnBhtn)}
                ${boldFormulaCell(grandDnTotalFormula, grandDnTotal)}
                ${boldFormulaCell(grandNvBhxhFormula, grandNvBhxh)}
                ${boldFormulaCell(grandNvBhytFormula, grandNvBhyt)}
                ${boldFormulaCell(grandNvBhtnFormula, grandNvBhtn)}
                ${boldFormulaCell(grandNvTotalFormula, grandNvTotal)}
                ${boldFormulaCell(grandAssessableFormula, grandAssessable)}
                ${boldFormulaCell(grandTaxFormula, grandTax)}
                ${boldFormulaCell(grandRemainingFormula, grandRemaining)}
            </tr>
        `;

        const htmlContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
            <meta charset="utf-8">
            <!--[if gte mso 9]>
            <xml>
            <x:ExcelWorkbook>
            <x:ExcelWorksheets>
            <x:ExcelWorksheet>
            <x:Name>Lương Chứng Từ</x:Name>
            <x:WorksheetOptions>
            <x:DisplayGridlines/>
            </x:WorksheetOptions>
            </x:ExcelWorksheet>
            </x:ExcelWorksheets>
            </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
              body, table, th, td, tr { font-family: "Times New Roman", Times, serif; font-size: 12pt; }
              table { border-collapse: collapse; }
              th, td { border: 0.5pt solid #A0A0A0; padding: 5px; }
              th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
              .title { font-size: 16pt; font-weight: bold; text-align: center; text-transform: uppercase; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
            </style>
            </head>
            <body>
              <table>
                <thead>
                  <tr>
                    <td colspan="27" class="title" style="border: none; text-align: center; font-size: 16pt; font-weight: bold; height: 50px;">BẢNG THANH TOÁN LƯƠNG NHÂN VIÊN THÁNG ${monthNum} NĂM ${year}</td>
                  </tr>
                  <tr><td colspan="27" style="border: none; height: 10px;"></td></tr>
                  <tr style="height: 30px;">
                    <th rowspan="2" style="width: 50px;">STT</th>
                    <th rowspan="2" style="width: 180px;">Họ và tên</th>
                    <th rowspan="2" style="width: 120px;">Chức vụ</th>
                    <th rowspan="2" style="width: 120px;">Lương cơ bản</th>
                    <th colspan="4">Hỗ trợ</th>
                    <th rowspan="2" style="width: 140px;">Phụ cấp giao nhận, bảo dưỡng tàu</th>
                    <th rowspan="2" style="width: 140px;">Tiền thưởng hoàn thành CV</th>
                    <th rowspan="2" style="width: 140px;">Tổng lương thực tế</th>
                    <th rowspan="2" style="width: 140px;">Thu nhập chịu thuế TNCN</th>
                    <th rowspan="2" style="width: 120px;">Giảm trừ bản thân</th>
                    <th rowspan="2" style="width: 80px;">Số lượng NPT</th>
                    <th rowspan="2" style="width: 120px;">Giảm trừ NPT</th>
                    <th rowspan="2" style="width: 120px;">Mức lương đóng BHXH</th>
                    <th colspan="4">Các khoản trích vào chi phí DN</th>
                    <th colspan="4">Các khoản trích vào lương của NV</th>
                    <th rowspan="2" style="width: 130px;">Thu nhập tính thuế</th>
                    <th rowspan="2" style="width: 120px;">Thuế TNCN</th>
                    <th rowspan="2" style="width: 140px;">Lương còn lại</th>
                  </tr>
                  <tr style="height: 35px;">
                    <th style="width: 110px;">Tiền ăn ca</th>
                    <th style="width: 110px;">Điện thoại</th>
                    <th style="width: 110px;">Phụ cấp</th>
                    <th style="width: 110px;">Xăng xe, đi lại</th>
                    <th style="width: 110px;">BHXH (17.5%)</th>
                    <th style="width: 110px;">BHYT (3%)</th>
                    <th style="width: 110px;">BHTN (1%)</th>
                    <th style="width: 110px;">Cộng</th>
                    <th style="width: 110px;">BHXH (8%)</th>
                    <th style="width: 110px;">BHYT (1.5%)</th>
                    <th style="width: 110px;">BHTN (1%)</th>
                    <th style="width: 110px;">Cộng</th>
                  </tr>
                  <tr style="font-size: 10pt; font-style: italic; background-color: #fafafa; text-align: center; height: 20px;">
                    <th></th><th></th><th></th><th></th>
                    <th>1</th><th>2</th><th>3</th><th>4</th>
                    <th>5</th><th>6</th>
                    <th>7 = [LCB+1+2+3+4+5+6]</th>
                    <th>8 = [7-1-2-3]</th>
                    <th>9</th><th>10</th>
                    <th>11 = 10 * 4.4M</th>
                    <th>12</th>
                    <th>13</th><th>14</th><th>15</th><th>16 = 13+14+15</th>
                    <th>17</th><th>18</th><th>19</th><th>20 = 17+18+19</th>
                    <th>21 = 8-9-11-20</th>
                    <th>22</th>
                    <th>23 = 7-20-22</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHTML}
                </tbody>
              </table>
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bang_Thanh_Toan_Luong_Chung_Tu_${month}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    exportFuelReport() {
        if (typeof XLSX === 'undefined') return alert('Chưa tải xong thư viện xuất Excel!');
        const wb = XLSX.utils.book_new();
        const formatDt = (iso) => iso ? new Date(iso).toLocaleString('vi-VN') : '';
        const vessels = AppData.state.vessels;
        
        vessels.forEach(v => {
            const rows = [];
            // Header for the vessel
            rows.push(['BÁO CÁO CHI TIẾT NHIÊN LIỆU - TÀU ' + v.name.toUpperCase()]);
            rows.push([]);
            rows.push([
                'ID Chuyến Dầu',
                'ID Chặng Hành Trình',
                'Mã Tàu',
                'Chuyến Dầu Số',
                'Mặt Hàng',
                'Số Dư Đầu Kỳ (L)',
                'Số Lượng Cấp (L)',
                'Ngày Cấp',
                'Nơi Cấp Dầu',
                'Nhà Cung Cấp Dầu',
                'Đơn Giá Dầu (VNĐ)',
                'Tổng Tiêu Thụ Chuyến (L)',
                'Số Dư Cuối Kỳ (L)',
                'Thứ Tự Chặng',
                'Nơi Đi',
                'Thời Gian Đi',
                'Nơi Đến',
                'Thời Gian Đến',
                'Định Mức Tiêu Thụ (L/h)',
                'Số Giờ Chạy (Giờ)',
                'Tiêu Thụ Chặng (L)'
            ]);
            
            const voyages = AppData.sortVoyages(AppData.getFuelVoyages(v.id), 'asc');
            let runningBalance = 0;
            if (voyages.length > 0) {
                runningBalance = Number(voyages[0].initialFuel || 0);
            }

            voyages.forEach(voy => {
                const stats = AppData.getFuelVoyageStats(voy.id);
                const logs = AppData.getFuelLogs(voy.id);
                runningBalance += Number(voy.addedFuel || 0);
                runningBalance -= stats.totalFuel;
                
                if (logs.length === 0) {
                    rows.push([
                        voy.id,
                        '',
                        v.id,
                        voy.voyageNo,
                        voy.cargoType || '',
                        voy.initialFuel || 0,
                        voy.addedFuel || 0,
                        voy.fuelDate || '',
                        voy.fuelLocation || '',
                        voy.fuelVendor || '',
                        voy.fuelUnitPrice || 0,
                        Math.round(stats.totalFuel),
                        Math.round(runningBalance),
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        ''
                    ]);
                } else {
                    logs.forEach((log, idx) => {
                        const fuelRate = Number(log.fuelRate) || 0;
                        const hours = Number(log.hours) || 0;
                        const legConsumption = Math.round(hours * fuelRate);

                        if (idx === 0) {
                            rows.push([
                                voy.id,
                                log.id,
                                v.id,
                                voy.voyageNo,
                                voy.cargoType || '',
                                voy.initialFuel || 0,
                                voy.addedFuel || 0,
                                voy.fuelDate || '',
                                voy.fuelLocation || '',
                                voy.fuelVendor || '',
                                voy.fuelUnitPrice || 0,
                                Math.round(stats.totalFuel),
                                Math.round(runningBalance),
                                idx + 1,
                                log.startPos || '',
                                formatDt(log.startTime),
                                log.endPos || '',
                                formatDt(log.endTime),
                                Math.round(fuelRate),
                                hours,
                                legConsumption
                            ]);
                        } else {
                            rows.push([
                                '',
                                log.id,
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                idx + 1,
                                log.startPos || '',
                                formatDt(log.startTime),
                                log.endPos || '',
                                formatDt(log.endTime),
                                Math.round(fuelRate),
                                hours,
                                legConsumption
                            ]);
                        }
                    });
                }
            });
            const ws = XLSX.utils.aoa_to_sheet(rows);
            // Set column widths
            ws['!cols'] = [
                {wch: 15}, {wch: 15}, {wch: 8}, {wch: 12}, {wch: 12}, 
                {wch: 15}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 18}, 
                {wch: 15}, {wch: 20}, {wch: 18}, {wch: 10}, {wch: 15}, 
                {wch: 20}, {wch: 15}, {wch: 20}, {wch: 18}, {wch: 15}, 
                {wch: 18}
            ];
            XLSX.utils.book_append_sheet(wb, ws, v.id);
        });
        
        XLSX.writeFile(wb, 'Bao_Cao_Nhien_Lieu_' + new Date().toISOString().slice(0,10) + '.xlsx');
    },

    exportFinancialReport(selectedMonth = '', selectedVessel = '', selectedCategory = '', selectedPartner = '') {
        if (typeof XLSX === 'undefined') return alert('Chưa tải xong thư viện xuất Excel!');
        if (selectedMonth === 'undefined') selectedMonth = '';
        if (selectedVessel === 'undefined') selectedVessel = '';
        if (selectedCategory === 'undefined') selectedCategory = '';
        if (selectedPartner === 'undefined') selectedPartner = '';
        
        const wb = XLSX.utils.book_new();
        const rows = [];
        
        rows.push(['BÁO CÁO CHI TIẾT TỔNG HỢP GIAO DỊCH THU CHI']);
        rows.push([]);
        rows.push([
            'ID Giao Dịch',
            'Ngày',
            'Tàu / Bộ Phận',
            'Hạng Mục',
            'Chuyến Số',
            'Số Hợp Đồng',
            'Đối Tác',
            'Nội Dung',
            'Thu Vào (VNĐ)',
            'Chi Ra (VNĐ)',
            'Tài Khoản'
        ]);
        
        let trans = AppData.getTransactions() || [];
        if (selectedMonth) {
            trans = trans.filter(t => t.date && t.date.substring(0, 7) === selectedMonth);
        }
        if (selectedVessel) {
            trans = trans.filter(t => t.vessel === selectedVessel);
        }
        if (selectedCategory) {
            trans = trans.filter(t => t.category === selectedCategory);
        }
        if (selectedPartner) {
            trans = trans.filter(t => t.partner === selectedPartner);
        }
        
        const sortedTrans = trans.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        
        sortedTrans.forEach(t => {
            rows.push([
                t.id || '',
                t.date || '',
                t.vessel || '',
                t.category || '',
                t.voyageNo || '',
                t.contractNo || '',
                t.partner || '',
                t.content || '',
                Number(t.thu) || 0,
                Number(t.chi) || 0,
                t.account || ''
            ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            {wch: 15}, // ID
            {wch: 12}, // Ngay
            {wch: 15}, // Tau/Bo phan
            {wch: 15}, // Hang muc
            {wch: 10}, // Chuyen So
            {wch: 15}, // So Hop Dong
            {wch: 25}, // Doi Tac
            {wch: 40}, // Noi dung
            {wch: 18}, // Thu
            {wch: 18}, // Chi
            {wch: 18}  // Tai Khoan
        ];
        
        let suffix = selectedMonth ? selectedMonth : 'Tat_Ca';
        if (selectedVessel) suffix += '_' + selectedVessel;
        if (selectedCategory) suffix += '_' + selectedCategory.replace(/[^a-zA-Z0-9]/g, '');
        if (selectedPartner) suffix += '_' + selectedPartner.replace(/[^a-zA-Z0-9]/g, '');
        
        const filename = 'Bao_Cao_Giao_Dich_' + suffix + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.utils.book_append_sheet(wb, ws, 'Giao_Dich');
        XLSX.writeFile(wb, filename);
    },

    exportSystemBackup() {
        if (typeof XLSX === 'undefined') return alert('Chưa tải xong thư viện xuất Excel!');
        const wb = XLSX.utils.book_new();

        // 1. Quản lý chuyến hàng
        const shipmentsRows = [];
        shipmentsRows.push(['DANH SÁCH CHI TIẾT CHUYẾN HÀNG']);
        shipmentsRows.push([]);
        shipmentsRows.push([
            'ID Chuyến Hàng', 'Số Hợp Đồng', 'Chuyến Số', 'Mã Tàu', 'Khách Hàng', 'Tên Hàng', 
            'Cảng Xếp (Đi)', 'Cảng Dỡ (Đến)', 'Ngày Xếp Hàng', 'Ngày Dỡ Hàng', 'Tháng Hạch Toán', 
            'Khối Lượng (Tấn)', 'Đơn Giá Thực (VNĐ)', 'Tiền Gửi (VND/tấn)', 'Giá Dầu Chuyến (VNĐ)', 
            'Số Giờ Chạy (Giờ)', 'Doanh Thu Thực Tế (VNĐ)', 'Doanh Thu Hóa Đơn (VNĐ)', 
            'Tiền Gửi Lại Khách (VNĐ)', 'Tiền Dầu DO (VNĐ)', 'Tiền Dầu LO (VNĐ)', 'Lương TV (VNĐ)', 
            'Tiền Ăn (VNĐ)', 'Bảo Hiểm (VNĐ)', 'Vật Tư Cty Cấp (VNĐ)', 'Vật Tư Tàu Chi (VNĐ)', 
            'CP Khác Cty Cấp (VNĐ)', 'Đại Lý 2 Đầu Cảng (VNĐ)', 'Tàu Chi 2 Đầu Cảng (VNĐ)', 
            'Tiền Bông (VNĐ)', 'Thuế VAT (VNĐ)', 'Hoa Tiêu, Tàu Lai, Phí Cảng (VNĐ)', 
            'Chi Phí Khác Tàu Chi (VNĐ)', 'Lãi Vay Ngân Hàng (VNĐ)', 'Lãi Vay Ngoài (VNĐ)', 'Lên Đà Trung Gian (VNĐ)', 'Lên Đà Định Kỳ (VNĐ)', 
            'Đăng Kiểm Hàng Năm (VNĐ)', 'Khấu Hao (VNĐ)', 'Bảo Hiểm Thân Vỏ (VNĐ)', 
            'Tổng Chi Phí (VNĐ)', 'Lợi Nhuận/Hiệu Quả (VNĐ)'
        ]);
        const ships = AppData.state.shipments || [];
        ships.forEach(s => {
            const qty = Number(s.qty || 0);
            const rate = Number(s.rate || 0);
            const markup = Number(s.markup || 0);
            const fuelPrice = Number(s.fuelPrice || 20000);
            const fuelHours = Number(s.fuelHours || 0);
            const revenueReal = Number(s.revenueReal || 0);
            const revenueInvoice = Number(s.revenueInvoice || 0);
            const refund = Number(s.refundAmount || 0);
            const costs = s.costs || {};
            const fuelDO = Number(costs.fuelDO || 0);
            const fuelLO = Number(costs.fuelLO || 0);
            const crewSalary = Number(costs.crewSalary || 0);
            const crewFood = Number(costs.crewFood || 0);
            const crewInsurance = Number(costs.crewInsurance || 0);
            const materialCompany = Number(costs.materialCompany || 0);
            const materialVessel = Number(costs.materialVessel || 0);
            const monthlyOther = Number(costs.monthlyOther || 0);
            const agent = Number(costs.agent || 0);
            const vessel2ends = Number(costs.vessel2ends || 0);
            const brokerage = Number(costs.brokerage || 0);
            const vat = Number(costs.vat || 0);
            const portFees = Number(costs.portFees || 0);
            const others = Number(costs.others || 0);
            const dockingIntermediate = this.excludeDockingDepreciation ? 0 : Number(costs.dockingIntermediate || 0);
            const dockingPeriodic = this.excludeDockingDepreciation ? 0 : Number(costs.dockingPeriodic || 0);
            const registryAnnual = Number(costs.registryAnnual || 0);
            const depreciation = this.excludeDockingDepreciation ? 0 : Number(costs.depreciation || 0);
            const hullInsurance = Number(costs.hullInsurance || 0);
            
            const totalExpenses = fuelDO + fuelLO + crewSalary + crewFood + crewInsurance + 
                                  materialCompany + materialVessel + monthlyOther + agent + 
                                  vessel2ends + brokerage + vat + portFees + others +
                                  (costs.loanInterest || 0) + (costs.loanInterestExternal || 0) +
                                  dockingIntermediate + dockingPeriodic + registryAnnual + depreciation + hullInsurance;
            const profit = revenueReal - totalExpenses;
            shipmentsRows.push([
                s.id || '', s.contractNo || '', s.voyageNo || '', s.vesselId || '', s.customer || '', s.cargo || '',
                s.portLoad || '', s.portDischarge || '', s.dateStart || '', s.dateEnd || '', s.reportMonth || '',
                qty, rate, markup, fuelPrice, fuelHours, revenueReal, revenueInvoice, refund,
                fuelDO, fuelLO, crewSalary, crewFood, crewInsurance, materialCompany, materialVessel,
                monthlyOther, agent, vessel2ends, brokerage, vat, portFees, others,
                costs.loanInterest || 0, costs.loanInterestExternal || 0,
                dockingIntermediate, dockingPeriodic, registryAnnual, depreciation, hullInsurance,
                totalExpenses, profit
            ]);
        });
        const wsShipments = XLSX.utils.aoa_to_sheet(shipmentsRows);
        wsShipments['!cols'] = Array(40).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsShipments, 'Quản lý chuyến hàng');

        // 2. Quản lý nhiên liệu
        const fuelRows = [];
        fuelRows.push(['DANH SÁCH CHI TIẾT NHIÊN LIỆU TOÀN BỘ CÁC TÀU']);
        fuelRows.push([]);
        fuelRows.push([
            'ID Chuyến Dầu', 'ID Chặng Hành Trình', 'Mã Tàu', 'Chuyến Dầu Số', 'Mặt Hàng',
            'Số Dư Đầu Kỳ (L)', 'Số Lượng Cấp (L)', 'Ngày Cấp', 'Nơi Cấp Dầu', 'Nhà Cung Cấp Dầu',
            'Đơn Giá Dầu (VNĐ)', 'Tổng Tiêu Thụ Chuyến (L)', 'Số Dư Cuối Kỳ (L)', 'Thứ Tự Chặng',
            'Nơi Đi', 'Thời Gian Đi', 'Nơi Đến', 'Thời Gian Đến', 'Định Mức Tiêu Thụ (L/h)',
            'Số Giờ Chạy (Giờ)', 'Tiêu Thụ Chặng (L)'
        ]);
        const formatDt = (iso) => iso ? new Date(iso).toLocaleString('vi-VN') : '';
        const vessels = AppData.state.vessels || [];
        vessels.forEach(v => {
            const voyages = AppData.sortVoyages(AppData.getFuelVoyages(v.id), 'asc') || [];
            let runningBalance = 0;
            if (voyages.length > 0) {
                runningBalance = Number(voyages[0].initialFuel || 0);
            }
            voyages.forEach(voy => {
                const stats = AppData.getFuelVoyageStats(voy.id) || { totalFuel: 0 };
                const logs = AppData.getFuelLogs(voy.id) || [];
                runningBalance += Number(voy.addedFuel || 0);
                runningBalance -= stats.totalFuel;
                
                if (logs.length === 0) {
                    fuelRows.push([
                        voy.id, '', v.id, voy.voyageNo, voy.cargoType || '', voy.initialFuel || 0,
                        voy.addedFuel || 0, voy.fuelDate || '', voy.fuelLocation || '', voy.fuelVendor || '',
                        voy.fuelUnitPrice || 0, Math.round(stats.totalFuel), Math.round(runningBalance),
                        '', '', '', '', '', '', '', ''
                    ]);
                } else {
                    logs.forEach((log, idx) => {
                        const fuelRate = Number(log.fuelRate) || 0;
                        const hours = Number(log.hours) || 0;
                        const legConsumption = Math.round(hours * fuelRate);
                        if (idx === 0) {
                            fuelRows.push([
                                voy.id, log.id, v.id, voy.voyageNo, voy.cargoType || '', voy.initialFuel || 0,
                                voy.addedFuel || 0, voy.fuelDate || '', voy.fuelLocation || '', voy.fuelVendor || '',
                                voy.fuelUnitPrice || 0, Math.round(stats.totalFuel), Math.round(runningBalance),
                                idx + 1, log.startPos || '', formatDt(log.startTime), log.endPos || '',
                                formatDt(log.endTime), Math.round(fuelRate), hours, legConsumption
                            ]);
                        } else {
                            fuelRows.push([
                                '', log.id, '', '', '', '', '', '', '', '', '', '', '',
                                idx + 1, log.startPos || '', formatDt(log.startTime), log.endPos || '',
                                formatDt(log.endTime), Math.round(fuelRate), hours, legConsumption
                            ]);
                        }
                    });
                }
            });
        });
        const wsFuel = XLSX.utils.aoa_to_sheet(fuelRows);
        wsFuel['!cols'] = Array(21).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsFuel, 'Quản lý nhiên liệu');

        // 3. Theo dõi tài chính
        const finRows = [];
        finRows.push(['DANH SÁCH CHI TIẾT TỔNG HỢP GIAO DỊCH THU CHI']);
        finRows.push([]);
        finRows.push([
            'ID Giao Dịch', 'Ngày', 'Tàu / Bộ Phận', 'Hạng Mục', 'Chuyến Số', 
            'Số Hợp Đồng', 'Đối Tác', 'Nội Dung', 'Thu Vào (VNĐ)', 'Chi Ra (VNĐ)', 'Tài Khoản'
        ]);
        const trans = AppData.state.transactions || [];
        const sortedTrans = trans.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        sortedTrans.forEach(t => {
            finRows.push([
                t.id || '', t.date || '', t.vessel || '', t.category || '', t.voyageNo || '',
                t.contractNo || '', t.partner || '', t.content || '', Number(t.thu) || 0, Number(t.chi) || 0, t.account || ''
            ]);
        });
        const wsFin = XLSX.utils.aoa_to_sheet(finRows);
        wsFin['!cols'] = Array(11).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsFin, 'Theo dõi tài chính');

        // 4. Quản lý chi phí tàu (Báo cáo Thuyền trưởng)
        const capRows = [];
        capRows.push(['DANH SÁCH BÁO CÁO THUYỀN TRƯỞNG & CHI PHÍ TÀU']);
        capRows.push([]);
        capRows.push([
            'Mã Báo Cáo', 'Mã Tàu', 'Tháng', 'Tiền Ăn (VNĐ)', 'Vật Tư Tàu Chi (VNĐ)', 
            'Tên Khoản Mục Cảng', 'Chuyến Cảng', 'Số Tiền Cảng (VNĐ)', 
            'Chuyến Tiền Bông', 'Số Tiền Bông (VNĐ)'
        ]);
        const reports = AppData.state.captainReports || [];
        const sortedReports = reports.slice().sort((a, b) => (a.month || '').localeCompare(b.month || '') || (a.vesselId || '').localeCompare(b.vesselId || ''));
        sortedReports.forEach(r => {
            const portExps = r.portExpenses || [];
            const brokerages = r.brokerages || [];
            const maxLen = Math.max(portExps.length, brokerages.length, 1);
            for (let i = 0; i < maxLen; i++) {
                const portItem = portExps[i] || {};
                const brokItem = brokerages[i] || {};
                if (i === 0) {
                    capRows.push([
                        r.id || '',
                        r.vesselId || '',
                        r.month || '',
                        Number(r.food) || 0,
                        Number(r.material) || 0,
                        portItem.port || '',
                        portItem.voyageNo || '',
                        Number(portItem.amount) || 0,
                        brokItem.voyageNo || '',
                        Number(brokItem.amount) || 0
                    ]);
                } else {
                    capRows.push([
                        '',
                        '',
                        '',
                        '',
                        '',
                        portItem.port || '',
                        portItem.voyageNo || '',
                        Number(portItem.amount) || 0,
                        brokItem.voyageNo || '',
                        Number(brokItem.amount) || 0
                    ]);
                }
            }
        });
        const wsExp = XLSX.utils.aoa_to_sheet(capRows);
        wsExp['!cols'] = Array(10).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsExp, 'Quản lý chi phí tàu');

        // 5. Nhân sự
        const hrRows = [];
        hrRows.push(['DANH SÁCH NHÂN SỰ VÀ THÔNG TIN LƯƠNG ĐỊNH BÌNH']);
        hrRows.push([]);
        hrRows.push([
            'ID Nhân Sự', 'Họ và Tên', 'Chức Vụ', 'Bộ Phận', 'Lương Cơ Bản (VNĐ)', 'Phụ Cấp (VNĐ)', 
            'Giảm Trừ Bản Thân (VNĐ)', 'Số Người Phụ Thuộc', 'Ngày Vào', 'Ngày Nghỉ', 'Số Điện Thoại', 'Ghi Chú',
            'Mức Lương Thực Tế (VNĐ)', 'Mức BHXH Đóng (VNĐ)', 'Tiền Ăn Ca (VNĐ)', 'Phụ Cấp Điện Thoại (VNĐ)',
            'Phụ Cấp Trang Phục (VNĐ)', 'Phụ Cấp Xăng Xe (VNĐ)', 'Phụ Cấp Giao Nhận (VNĐ)', 'Thưởng Hoàn Thành (VNĐ)'
        ]);
        const employees = AppData.getEmployees() || [];
        employees.forEach(e => {
            hrRows.push([
                e.id || '', e.name || '', e.role || '', e.department || '', Number(e.basicSalary) || 0, Number(e.allowances) || 0,
                Number(e.personalDeduction) || 15500000, Number(e.dependents) || 0, e.joinDate || '', e.leaveDate || '',
                e.phone || '', e.notes || '', Number(e.actualSalary) || 0, Number(e.insurance) || 0, Number(e.mealAllowance) || 0,
                Number(e.phoneAllowance) || 0, Number(e.clothingAllowance) || 0, Number(e.transportAllowance) || 0,
                Number(e.deliveryAllowance) || 0, Number(e.completionBonus) || 0
            ]);
        });
        const wsHr = XLSX.utils.aoa_to_sheet(hrRows);
        wsHr['!cols'] = Array(20).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsHr, 'Nhân sự');

        // 6. Lương
        const salRows = [];
        salRows.push(['DANH SÁCH BẢNG CHẤM CÔNG VÀ ĐIỂM DANH HÀNG THÁNG']);
        salRows.push([]);
        salRows.push([
            'Tháng', 'Bộ Phận', 'Số Chuyến', 'Dữ Liệu Điểm Danh (JSON)'
        ]);
        const tsheets = AppData.state.timesheets || [];
        tsheets.forEach(ts => {
            salRows.push([
                ts.month || '', ts.department || '', Number(ts.voyageCount) || 0, JSON.stringify(ts.attendance || {})
            ]);
        });
        const wsSal = XLSX.utils.aoa_to_sheet(salRows);
        wsSal['!cols'] = Array(4).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsSal, 'Lương');

        // 7. Chi phí theo tháng
        const mCostsRows = [];
        mCostsRows.push(['DANH SÁCH CHI PHÍ CỐ ĐỊNH THEO THÁNG CỦA CÁC TÀU']);
        mCostsRows.push([]);
        mCostsRows.push([
            'Tháng', 'Mã Tàu', 'Lương (VNĐ)', 'Bảo Hiểm (VNĐ)', 'Tiền Ăn (VNĐ)',
            'Vật Tư Công Ty Cấp (VNĐ)', 'Vật Tư Tàu Chi (VNĐ)', 'Chi Phí Khác (VNĐ)', 'Lãi Vay Ngân Hàng (VNĐ)', 'Lãi Vay Ngoài (VNĐ)'
        ]);
        const mCosts = AppData.state.monthlyCosts || [];
        mCosts.forEach(c => {
            mCostsRows.push([
                c.month || '', c.vesselId || '', Number(c.salary) || 0, Number(c.insurance) || 0, Number(c.food) || 0,
                Number(c.materialCompany) || 0, Number(c.materialVessel) || 0, Number(c.other) || 0, Number(c.loanInterest) || 0, Number(c.loanInterestExternal) || 0
            ]);
        });
        const wsMcosts = XLSX.utils.aoa_to_sheet(mCostsRows);
        wsMcosts['!cols'] = Array(10).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsMcosts, 'Chi phí theo tháng');

        // 8. Đối tác
        const partnerRows = [];
        partnerRows.push(['DANH SÁCH KHÁCH HÀNG VÀ NHÀ CUNG CẤP']);
        partnerRows.push([]);
        partnerRows.push(['Loại', 'ID Đối Tác', 'Tên Đối Tác', 'Phân Loại / Mặt Hàng', 'Liên Hệ', 'Địa Chỉ']);
        const vendors = AppData.state.vendors || [];
        vendors.forEach(v => {
            partnerRows.push(['NCC', v.id || '', v.name || '', v.type || '', v.contact || '', v.address || '']);
        });
        const customers = AppData.state.customers || [];
        customers.forEach(c => {
            partnerRows.push(['Khách Hàng', c.id || '', c.name || '', '', c.contact || '', c.address || '']);
        });
        const wsPartner = XLSX.utils.aoa_to_sheet(partnerRows);
        wsPartner['!cols'] = Array(6).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsPartner, 'Đối tác');

        // 9. Tàu
        const vesselRows = [];
        vesselRows.push(['DANH SÁCH CÁC TÀU VÀ ĐỊNH MỨC']);
        vesselRows.push([]);
        vesselRows.push(['Mã Tàu', 'Tên Tàu', 'Trọng Tải (Tấn)', 'Thuyền Trưởng', 'Định Mức Dầu DO (L/h)']);
        const ves = AppData.state.vessels || [];
        ves.forEach(v => {
            vesselRows.push([v.id || '', v.name || '', Number(v.capacity) || 0, v.captain || '', Number(v.fuelRate) || 0]);
        });
        const wsVessels = XLSX.utils.aoa_to_sheet(vesselRows);
        wsVessels['!cols'] = Array(5).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsVessels, 'Tàu');

        // 10. Thông tin công ty
        const compRows = [];
        compRows.push(['THÔNG TIN DOANH NGHIỆP VÀ SỐ DƯ ĐẦU KỲ']);
        compRows.push([]);
        compRows.push([
            'Tên Doanh Nghiệp', 'Mã Số Thuế', 'Thông Tin Ngân Hàng', 'Địa Chỉ',
            'Số Dư Đầu Kỳ ABbank (VNĐ)', 'Số Dư Đầu Kỳ Viettinbank (VNĐ)', 
            'Số Dư Đầu Kỳ Tài Khoản Cá Nhân (VNĐ)', 'Số Dư Đầu Kỳ Tiền Mặt (VNĐ)'
        ]);
        const comp = AppData.state.company || {};
        const balances = comp.openingBalances || {};
        compRows.push([
            comp.name || '', comp.taxId || '', comp.bankInfo || '', comp.address || '',
            Number(balances.ABbank) || 0, Number(balances.Viettinbank) || 0,
            Number(balances['Tài khoản cá nhân']) || 0, Number(balances['Tiền mặt']) || 0
        ]);
        const wsComp = XLSX.utils.aoa_to_sheet(compRows);
        wsComp['!cols'] = Array(8).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsComp, 'Thông tin công ty');

        // 11. Chi phí hàng năm
        const annualRows = [];
        annualRows.push(['DANH SÁCH CHI PHÍ HÀNG NĂM CỦA TỪNG TÀU']);
        annualRows.push([]);
        annualRows.push([
            'Năm', 'Mã Tàu', 
            'Lên Đà Trung Gian (VNĐ)', 'Số Năm Phân Bổ (Trung Gian)', 'Lịch Lên Đà TG (YYYY-MM-DD)', 
            'Lên Đà Định Kỳ (VNĐ)', 'Số Năm Phân Bổ (Định Kỳ)', 'Lịch Lên Đà ĐK (YYYY-MM-DD)', 
            'Đăng Kiểm Hàng Năm (VNĐ)', 'Số Năm Phân Bổ (Đăng Kiểm)', 'Lịch Đăng Kiểm (YYYY-MM-DD)', 
            'Khấu Hao (VNĐ)', 'Bảo Hiểm Thân Vỏ (VNĐ)', 'Sửa Chữa Lớn (VNĐ)'
        ]);
        const annualCosts = AppData.state.annualCosts || [];
        annualCosts.forEach(c => {
            annualRows.push([
                c.year,
                c.vesselId,
                c.dockingIntermediateCost || 0,
                c.dockingIntermediateYears || 2.5,
                c.dockingIntermediateDate || '',
                c.dockingPeriodicCost || 0,
                c.dockingPeriodicYears || 5,
                c.dockingPeriodicDate || '',
                c.registryAnnualCost || 0,
                c.registryAnnualYears || 1,
                c.registryAnnualDate || '',
                c.depreciationCost || 0,
                c.hullInsuranceCost || 0,
                c.largeRepairCost || 0
            ]);
        });
        const wsAnnual = XLSX.utils.aoa_to_sheet(annualRows);
        wsAnnual['!cols'] = Array(14).fill({wch: 18});
        XLSX.utils.book_append_sheet(wb, wsAnnual, 'Chi phí hàng năm');

        // Save Workbook
        const filename = 'Bao_Cao_Sao_Luu_He_Thong_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.writeFile(wb, filename);
    },

    importSystemBackupExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const parseExcelDate = (val) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                        const dateObj = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
                        return dateObj.toISOString().slice(0, 10);
                    }
                    const str = String(val).trim();
                    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
                    if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                        const parts = str.split('/');
                        const d = parts[0].padStart(2, '0');
                        const m = parts[1].padStart(2, '0');
                        const y = parts[2];
                        return `${y}-${m}-${d}`;
                    }
                    const parsed = new Date(str);
                    return isNaN(parsed.getTime()) ? str : parsed.toISOString().slice(0, 10);
                };

                const parseExcelDateTime = (val) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                        const dateObj = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
                        return dateObj.toISOString();
                    }
                    const str = String(val).trim();
                    const parts = str.split(', ');
                    if (parts.length === 2) {
                        const [datePart, timePart] = parts;
                        const [d, m, y] = datePart.split('/');
                        return `${y}-${m}-${d}T${timePart}`;
                    }
                    const dateObj = new Date(str);
                    return isNaN(dateObj.getTime()) ? str : dateObj.toISOString();
                };

                let restoredSheets = [];

                // 1. Quản lý chuyến hàng
                const wsShipments = workbook.Sheets['Quản lý chuyến hàng'];
                if (wsShipments) {
                    const rows = XLSX.utils.sheet_to_json(wsShipments, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        
                        const idIdx = colIdx('ID Chuyến Hàng');
                        const contractNoIdx = colIdx('Số Hợp Đồng');
                        const voyageNoIdx = colIdx('Chuyến Số');
                        const vesselIdIdx = colIdx('Mã Tàu');
                        const customerIdx = colIdx('Khách Hàng');
                        const cargoIdx = colIdx('Tên Hàng');
                        const portLoadIdx = colIdx('Cảng Xếp (Đi)');
                        const portDischargeIdx = colIdx('Cảng Dỡ (Đến)');
                        const dateStartIdx = colIdx('Ngày Xếp Hàng');
                        const dateEndIdx = colIdx('Ngày Dỡ Hàng');
                        const reportMonthIdx = colIdx('Tháng Hạch Toán');
                        const qtyIdx = colIdx('Khối Lượng (Tấn)');
                        const rateIdx = colIdx('Đơn Giá Thực (VNĐ)');
                        const markupIdx = colIdx('Tiền Gửi (VND/tấn)');
                        const fuelPriceIdx = colIdx('Giá Dầu Chuyến (VNĐ)');
                        const fuelHoursIdx = colIdx('Số Giờ Chạy (Giờ)');
                        const revenueRealIdx = colIdx('Doanh Thu Thực Tế (VNĐ)');
                        const revenueInvoiceIdx = colIdx('Doanh Thu Hóa Đơn (VNĐ)');
                        const refundIdx = colIdx('Tiền Gửi Lại Khách (VNĐ)');
                        
                        const costsMap = {
                            fuelDO: colIdx('Tiền Dầu DO (VNĐ)'),
                            fuelLO: colIdx('Tiền Dầu LO (VNĐ)'),
                            crewSalary: colIdx('Lương TV (VNĐ)'),
                            crewFood: colIdx('Tiền Ăn (VNĐ)'),
                            crewInsurance: colIdx('Bảo Hiểm (VNĐ)'),
                            materialCompany: colIdx('Vật Tư Cty Cấp (VNĐ)'),
                            materialVessel: colIdx('Vật Tư Tàu Chi (VNĐ)'),
                            monthlyOther: colIdx('CP Khác Cty Cấp (VNĐ)'),
                            agent: colIdx('Đại Lý 2 Đầu Cảng (VNĐ)'),
                            vessel2ends: colIdx('Tàu Chi 2 Đầu Cảng (VNĐ)'),
                            brokerage: colIdx('Tiền Bông (VNĐ)'),
                            vat: colIdx('Thuế VAT (VNĐ)'),
                            portFees: colIdx('Hoa Tiêu, Tàu Lai, Phí Cảng (VNĐ)'),
                            others: colIdx('Chi Phí Khác Tàu Chi (VNĐ)'),
                            loanInterest: colIdx('Lãi Vay Ngân Hàng (VNĐ)') !== -1 ? colIdx('Lãi Vay Ngân Hàng (VNĐ)') : colIdx('Lãi Vay (VNĐ)'),
                            loanInterestExternal: colIdx('Lãi Vay Ngoài (VNĐ)'),
                            dockingIntermediate: colIdx('Lên Đà Trung Gian (VNĐ)'),
                            dockingPeriodic: colIdx('Lên Đà Định Kỳ (VNĐ)'),
                            registryAnnual: colIdx('Đăng Kiểm Hàng Năm (VNĐ)'),
                            depreciation: colIdx('Khấu Hao (VNĐ)'),
                            hullInsurance: colIdx('Bảo Hiểm Thân Vỏ (VNĐ)')
                        };

                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[contractNoIdx]) return;
                            const id = row[idIdx] || ('S' + Date.now() + Math.random().toString().slice(2, 6));
                            const s = {
                                id,
                                contractNo: String(row[contractNoIdx] || '').trim(),
                                voyageNo: String(row[voyageNoIdx] || '').trim(),
                                vesselId: String(row[vesselIdIdx] || '').trim(),
                                customer: String(row[customerIdx] || '').trim(),
                                cargo: String(row[cargoIdx] || '').trim(),
                                portLoad: String(row[portLoadIdx] || '').trim(),
                                portDischarge: String(row[portDischargeIdx] || '').trim(),
                                dateStart: row[dateStartIdx] ? parseExcelDate(row[dateStartIdx]) : '',
                                dateEnd: row[dateEndIdx] ? parseExcelDate(row[dateEndIdx]) : '',
                                reportMonth: String(row[reportMonthIdx] || '').trim(),
                                qty: Number(row[qtyIdx]) || 0,
                                rate: Number(row[rateIdx]) || 0,
                                markup: Number(row[markupIdx]) || 0,
                                fuelPrice: Number(row[fuelPriceIdx]) || 0,
                                fuelHours: Number(row[fuelHoursIdx]) || 0,
                                revenueReal: Number(row[revenueRealIdx]) || 0,
                                revenueInvoice: Number(row[revenueInvoiceIdx]) || 0,
                                refundAmount: Number(row[refundIdx]) || 0,
                                costs: {}
                            };
                            for (let key in costsMap) {
                                const idx = costsMap[key];
                                s.costs[key] = idx !== -1 ? (Number(row[idx]) || 0) : 0;
                            }
                            
                            const existingIdx = AppData.state.shipments.findIndex(x => x.id === id);
                            if (existingIdx >= 0) AppData.state.shipments[existingIdx] = s;
                            else AppData.state.shipments.push(s);
                        });
                        restoredSheets.push('Quản lý chuyến hàng');
                    }
                }

                // 2. Quản lý nhiên liệu
                const wsFuel = workbook.Sheets['Quản lý nhiên liệu'];
                if (wsFuel) {
                    const rows = XLSX.utils.sheet_to_json(wsFuel, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        
                        const voyIdIdx = colIdx('ID Chuyến Dầu');
                        const logIdIdx = colIdx('ID Chặng Hành Trình');
                        const vesselIdIdx = colIdx('Mã Tàu');
                        const voyageNoIdx = colIdx('Chuyến Dầu Số');
                        const cargoTypeIdx = colIdx('Mặt Hàng');
                        const initialFuelIdx = colIdx('Số Dư Đầu Kỳ (L)');
                        const addedFuelIdx = colIdx('Số Lượng Cấp (L)');
                        const fuelDateIdx = colIdx('Ngày Cấp');
                        const fuelLocationIdx = colIdx('Nơi Cấp Dầu');
                        const fuelVendorIdx = colIdx('Nhà Cung Cấp Dầu');
                        const fuelUnitPriceIdx = colIdx('Đơn Giá Dầu (VNĐ)');
                        
                        const startPosIdx = colIdx('Nơi Đi');
                        const startTimeIdx = colIdx('Thời Gian Đi');
                        const endPosIdx = colIdx('Nơi Đến');
                        const endTimeIdx = colIdx('Thời Gian Đến');
                        const fuelRateIdx = colIdx('Định Mức Tiêu Thụ (L/h)');
                        const hoursIdx = colIdx('Số Giờ Chạy (Giờ)');
                        
                        let lastVoyageId = '';
                        let lastVesselId = '';
                        
                        dataRows.forEach(row => {
                            if (row.length === 0) return;
                            if (row[voyIdIdx]) {
                                lastVoyageId = String(row[voyIdIdx]).trim();
                                lastVesselId = String(row[vesselIdIdx] || lastVesselId).trim();
                                const voy = {
                                    id: lastVoyageId,
                                    vesselId: lastVesselId,
                                    voyageNo: String(row[voyageNoIdx] || '').trim(),
                                    cargoType: String(row[cargoTypeIdx] || '').trim(),
                                    initialFuel: Number(row[initialFuelIdx]) || 0,
                                    addedFuel: Number(row[addedFuelIdx]) || 0,
                                    fuelDate: row[fuelDateIdx] ? parseExcelDate(row[fuelDateIdx]) : '',
                                    fuelVendor: String(row[fuelVendorIdx] || '').trim(),
                                    fuelLocation: String(row[fuelLocationIdx] || '').trim(),
                                    fuelUnitPrice: Number(row[fuelUnitPriceIdx]) || 0
                                };
                                const existingIdx = AppData.state.fuelVoyages.findIndex(x => x.id === voy.id);
                                if (existingIdx >= 0) AppData.state.fuelVoyages[existingIdx] = voy;
                                else AppData.state.fuelVoyages.push(voy);
                            }
                            if (row[logIdIdx] && lastVoyageId) {
                                const logId = String(row[logIdIdx]).trim();
                                const log = {
                                    id: logId,
                                    fuelVoyageId: lastVoyageId,
                                    startTime: parseExcelDateTime(row[startTimeIdx]),
                                    startPos: String(row[startPosIdx] || '').trim(),
                                    endTime: parseExcelDateTime(row[endTimeIdx]),
                                    endPos: String(row[endPosIdx] || '').trim(),
                                    fuelRate: Number(row[fuelRateIdx]) || 0,
                                    hours: Number(row[hoursIdx]) || 0
                                };
                                const existingIdx = AppData.state.fuelLogs.findIndex(x => x.id === log.id);
                                if (existingIdx >= 0) AppData.state.fuelLogs[existingIdx] = log;
                                else AppData.state.fuelLogs.push(log);
                            }
                        });
                        restoredSheets.push('Quản lý nhiên liệu');
                    }
                }

                // 3. Theo dõi tài chính
                const wsFin = workbook.Sheets['Theo dõi tài chính'];
                const affectedAllocations = new Set();
                if (wsFin) {
                    const rows = XLSX.utils.sheet_to_json(wsFin, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        
                        const idIdx = colIdx('ID Giao Dịch');
                        const dateIdx = colIdx('Ngày');
                        const vesselIdx = colIdx('Tàu / Bộ Phận');
                        const categoryIdx = colIdx('Hạng Mục');
                        const voyageNoIdx = colIdx('Chuyến Số');
                        const contractNoIdx = colIdx('Số Hợp Đồng');
                        const partnerIdx = colIdx('Đối Tác');
                        const contentIdx = colIdx('Nội Dung');
                        const thuIdx = colIdx('Thu Vào (VNĐ)');
                        const chiIdx = colIdx('Chi Ra (VNĐ)');
                        const accountIdx = colIdx('Tài Khoản');
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[dateIdx]) return;
                            const id = row[idIdx] ? String(row[idIdx]).trim() : ('TR' + Date.now() + Math.random().toString().slice(2, 6));
                            const dateStr = parseExcelDate(row[dateIdx]);
                            const t = {
                                id,
                                date: dateStr,
                                vessel: String(row[vesselIdx] || 'VP').trim(),
                                category: String(row[categoryIdx] || '').trim(),
                                voyageNo: row[voyageNoIdx] ? String(row[voyageNoIdx]).trim() : '',
                                contractNo: row[contractNoIdx] ? String(row[contractNoIdx]).trim() : '',
                                partner: String(row[partnerIdx] || '').trim(),
                                content: String(row[contentIdx] || '').trim(),
                                thu: Number(row[thuIdx]) || 0,
                                chi: Number(row[chiIdx]) || 0,
                                account: String(row[accountIdx] || 'Tiền mặt').trim()
                            };
                            
                            const existingIdx = AppData.state.transactions.findIndex(x => x.id === id);
                            const oldTx = existingIdx >= 0 ? { ...AppData.state.transactions[existingIdx] } : null;
                            if (existingIdx >= 0) AppData.state.transactions[existingIdx] = t;
                            else AppData.state.transactions.push(t);
                            
                            if (t.vessel && t.vessel !== 'VP' && t.date && (t.category === '9.Vật Tư' || t.category === '6.Lãi Vay')) {
                                affectedAllocations.add(`${t.vessel}_${t.date.substring(0, 7)}`);
                            }
                            if (oldTx && oldTx.vessel && oldTx.vessel !== 'VP' && oldTx.date && (oldTx.category === '9.Vật Tư' || oldTx.category === '6.Lãi Vay')) {
                                affectedAllocations.add(`${oldTx.vessel}_${oldTx.date.substring(0, 7)}`);
                            }
                        });
                        restoredSheets.push('Theo dõi tài chính');
                    }
                }

                // 4. Quản lý chi phí tàu (Báo cáo Thuyền trưởng)
                const wsExp = workbook.Sheets['Quản lý chi phí tàu'] || workbook.Sheets['Theo dõi tài chính tàu chi'];
                if (wsExp) {
                    const rows = XLSX.utils.sheet_to_json(wsExp, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        
                        const hasNewFormat = colIdx('Mã Báo Cáo') !== -1;
                        if (hasNewFormat) {
                            const idIdx = colIdx('Mã Báo Cáo');
                            const vesselIdx = colIdx('Mã Tàu');
                            const monthIdx = colIdx('Tháng');
                            const foodIdx = colIdx('Tiền Ăn (VNĐ)');
                            const materialIdx = colIdx('Vật Tư Tàu Chi (VNĐ)');
                            const portNameIdx = colIdx('Tên Khoản Mục Cảng');
                            const portVoyageIdx = colIdx('Chuyến Cảng');
                            const portAmountIdx = colIdx('Số Tiền Cảng (VNĐ)');
                            const brokVoyageIdx = colIdx('Chuyến Tiền Bông');
                            const brokAmountIdx = colIdx('Số Tiền Bông (VNĐ)');
                            
                            let currentReport = null;
                            const reportsMap = {};
                            
                            dataRows.forEach(row => {
                                if (row.length === 0) return;
                                if (row[idIdx]) {
                                    const id = String(row[idIdx]).trim();
                                    currentReport = {
                                        id,
                                        vesselId: String(row[vesselIdx] || '').trim(),
                                        month: String(row[monthIdx] || '').trim(),
                                        food: Number(row[foodIdx]) || 0,
                                        material: Number(row[materialIdx]) || 0,
                                        portExpenses: [],
                                        brokerages: []
                                    };
                                    reportsMap[id] = currentReport;
                                }
                                
                                if (currentReport) {
                                    const portName = row[portNameIdx] ? String(row[portNameIdx]).trim() : '';
                                    const portAmount = Number(row[portAmountIdx]) || 0;
                                    const portVoyage = row[portVoyageIdx] ? String(row[portVoyageIdx]).trim() : '';
                                    if (portName || portAmount > 0) {
                                        currentReport.portExpenses.push({
                                            port: portName,
                                            amount: portAmount,
                                            voyageNo: portVoyage
                                        });
                                    }
                                    
                                    const brokVoyage = row[brokVoyageIdx] ? String(row[brokVoyageIdx]).trim() : '';
                                    const brokAmount = Number(row[brokAmountIdx]) || 0;
                                    if (brokVoyage || brokAmount > 0) {
                                        currentReport.brokerages.push({
                                            voyageNo: brokVoyage,
                                            amount: brokAmount
                                        });
                                    }
                                }
                            });
                            
                            if (!AppData.state.captainReports) AppData.state.captainReports = [];
                            Object.values(reportsMap).forEach(report => {
                                const existingIdx = AppData.state.captainReports.findIndex(x => x.id === report.id);
                                if (existingIdx >= 0) {
                                    AppData.state.captainReports[existingIdx] = report;
                                } else {
                                    AppData.state.captainReports.push(report);
                                }
                                AppData.recalculateVesselAllocations(report.vesselId, report.month);
                            });
                            restoredSheets.push('Quản lý chi phí tàu');
                        } else {
                            // Old format
                            const idIdx = colIdx('ID Chi Phí');
                            const dateIdx = colIdx('Ngày');
                            const vesselIdx = colIdx('Mã Tàu');
                            const voyageNoIdx = colIdx('Chuyến Số');
                            const categoryIdx = colIdx('Hạng Mục');
                            const amountIdx = colIdx('Số Tiền (VNĐ)');
                            const contentIdx = colIdx('Nội Dung');
                            
                            dataRows.forEach(row => {
                                if (row.length === 0 || !row[dateIdx]) return;
                                const id = row[idIdx] ? String(row[idIdx]).trim() : ('VE-' + Date.now() + Math.random().toString().slice(2, 6));
                                const dateStr = parseExcelDate(row[dateIdx]);
                                const ve = {
                                    id,
                                    date: dateStr,
                                    vesselId: String(row[vesselIdx] || '').trim(),
                                    voyageNo: String(row[voyageNoIdx] || '').trim(),
                                    category: String(row[categoryIdx] || '').trim(),
                                    amount: Number(row[amountIdx]) || 0,
                                    content: String(row[contentIdx] || '').trim()
                                };
                                const existingIdx = AppData.state.vesselExpenses.findIndex(x => x.id === id);
                                if (existingIdx >= 0) AppData.state.vesselExpenses[existingIdx] = ve;
                                else AppData.state.vesselExpenses.push(ve);
                            });
                            restoredSheets.push('Theo dõi tài chính tàu chi');
                        }
                    }
                }

                // 5. Nhân sự
                const wsHr = workbook.Sheets['Nhân sự'];
                if (wsHr) {
                    const rows = XLSX.utils.sheet_to_json(wsHr, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        
                        const idIdx = colIdx('ID Nhân Sự');
                        const nameIdx = colIdx('Họ và Tên');
                        const roleIdx = colIdx('Chức Vụ');
                        const departmentIdx = colIdx('Bộ Phận');
                        const basicSalaryIdx = colIdx('Lương Cơ Bản (VNĐ)');
                        const allowancesIdx = colIdx('Phụ Cấp (VNĐ)');
                        const personalDeductionIdx = colIdx('Giảm Trừ Bản Thân (VNĐ)');
                        const dependentsIdx = colIdx('Số Người Phụ Thuộc');
                        const joinDateIdx = colIdx('Ngày Vào');
                        const leaveDateIdx = colIdx('Ngày Nghỉ');
                        const phoneIdx = colIdx('Số Điện Thoại');
                        const notesIdx = colIdx('Ghi Chú');
                        
                        const actualSalaryIdx = colIdx('Mức Lương Thực Tế (VNĐ)');
                        const insuranceIdx = colIdx('Mức BHXH Đóng (VNĐ)');
                        const mealAllowanceIdx = colIdx('Tiền Ăn Ca (VNĐ)');
                        const phoneAllowanceIdx = colIdx('Phụ Cấp Điện Thoại (VNĐ)');
                        const clothingAllowanceIdx = colIdx('Phụ Cấp Trang Phục (VNĐ)');
                        const transportAllowanceIdx = colIdx('Phụ Cấp Xăng Xe (VNĐ)');
                        const deliveryAllowanceIdx = colIdx('Phụ Cấp Giao Nhận (VNĐ)');
                        const completionBonusIdx = colIdx('Thưởng Hoàn Thành (VNĐ)');
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[nameIdx]) return;
                            const id = row[idIdx] ? String(row[idIdx]).trim() : ('EMP-' + Date.now() + Math.random().toString().slice(2, 6));
                            const emp = {
                                id,
                                name: String(row[nameIdx]).trim(),
                                role: String(row[roleIdx] || '').trim(),
                                department: String(row[departmentIdx] || 'VP').trim(),
                                basicSalary: Number(row[basicSalaryIdx]) || 0,
                                allowances: Number(row[allowancesIdx]) || 0,
                                personalDeduction: Number(row[personalDeductionIdx]) || 15500000,
                                dependents: Number(row[dependentsIdx]) || 0,
                                joinDate: row[joinDateIdx] ? parseExcelDate(row[joinDateIdx]) : '',
                                leaveDate: row[leaveDateIdx] ? parseExcelDate(row[leaveDateIdx]) : '',
                                phone: String(row[phoneIdx] || '').trim(),
                                notes: String(row[notesIdx] || '').trim(),
                                actualSalary: Number(row[actualSalaryIdx]) || 0,
                                insurance: Number(row[insuranceIdx]) || 0,
                                mealAllowance: Number(row[mealAllowanceIdx]) || 0,
                                phoneAllowance: Number(row[phoneAllowanceIdx]) || 0,
                                clothingAllowance: Number(row[clothingAllowanceIdx]) || 0,
                                transportAllowance: Number(row[transportAllowanceIdx]) || 0,
                                deliveryAllowance: Number(row[deliveryAllowanceIdx]) || 0,
                                completionBonus: Number(row[completionBonusIdx]) || 0
                            };
                            const existingIdx = AppData.state.employees.findIndex(x => x.id === id);
                            if (existingIdx >= 0) AppData.state.employees[existingIdx] = emp;
                            else AppData.state.employees.push(emp);
                        });
                        restoredSheets.push('Nhân sự');
                    }
                }

                // 6. Lương
                const wsSal = workbook.Sheets['Lương'];
                if (wsSal) {
                    const rows = XLSX.utils.sheet_to_json(wsSal, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        const monthIdx = colIdx('Tháng');
                        const departmentIdx = colIdx('Bộ Phận');
                        const voyageCountIdx = colIdx('Số Chuyến');
                        const attendanceIdx = colIdx('Dữ Liệu Điểm Danh (JSON)');
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[monthIdx] || !row[departmentIdx]) return;
                            const month = String(row[monthIdx]).trim();
                            const department = String(row[departmentIdx]).trim();
                            let attendance = {};
                            try {
                                if (row[attendanceIdx]) {
                                    attendance = JSON.parse(String(row[attendanceIdx]).trim());
                                }
                            } catch (err) {
                                console.error('Lỗi parse JSON điểm danh:', err);
                            }
                            const ts = {
                                month,
                                department,
                                voyageCount: Number(row[voyageCountIdx]) || 0,
                                attendance
                            };
                            const existingIdx = AppData.state.timesheets.findIndex(x => x.month === month && x.department === department);
                            if (existingIdx >= 0) AppData.state.timesheets[existingIdx] = ts;
                            else AppData.state.timesheets.push(ts);
                        });
                        restoredSheets.push('Lương');
                    }
                }

                // 7. Chi phí theo tháng
                const wsMcosts = workbook.Sheets['Chi phí theo tháng'];
                if (wsMcosts) {
                    const rows = XLSX.utils.sheet_to_json(wsMcosts, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        const monthIdx = colIdx('Tháng');
                        const vesselIdx = colIdx('Mã Tàu');
                        const salaryIdx = colIdx('Lương (VNĐ)');
                        const insuranceIdx = colIdx('Bảo Hiểm (VNĐ)');
                        const foodIdx = colIdx('Tiền Ăn (VNĐ)');
                        const matCIdx = colIdx('Vật Tư Công Ty Cấp (VNĐ)');
                        const matVIdx = colIdx('Vật Tư Tàu Chi (VNĐ)');
                        const otherIdx = colIdx('Chi Phí Khác (VNĐ)');
                        const loanIdx = colIdx('Lãi Vay Ngân Hàng (VNĐ)');
                        const loanExtIdx = colIdx('Lãi Vay Ngoài (VNĐ)');
                        const oldLoanIdx = colIdx('Lãi Vay (VNĐ)'); // Fallback
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[monthIdx] || !row[vesselIdx]) return;
                            const month = String(row[monthIdx]).trim();
                            const vesselId = String(row[vesselIdx]).trim();
                            const c = {
                                month,
                                vesselId,
                                salary: Number(row[salaryIdx]) || 0,
                                insurance: Number(row[insuranceIdx]) || 0,
                                food: Number(row[foodIdx]) || 0,
                                materialCompany: Number(row[matCIdx]) || 0,
                                materialVessel: Number(row[matVIdx]) || 0,
                                other: Number(row[otherIdx]) || 0,
                                loanInterest: Number(row[loanIdx !== -1 ? loanIdx : oldLoanIdx]) || 0,
                                loanInterestExternal: Number(row[loanExtIdx]) || 0
                            };
                            const existingIdx = AppData.state.monthlyCosts.findIndex(x => x.month === month && x.vesselId === vesselId);
                            if (existingIdx >= 0) AppData.state.monthlyCosts[existingIdx] = c;
                            else AppData.state.monthlyCosts.push(c);
                        });
                        restoredSheets.push('Chi phí theo tháng');
                    }
                }

                // 8. Đối tác
                const wsPartner = workbook.Sheets['Đối tác'];
                if (wsPartner) {
                    const rows = XLSX.utils.sheet_to_json(wsPartner, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        const typeIdx = colIdx('Loại');
                        const idIdx = colIdx('ID Đối Tác');
                        const nameIdx = colIdx('Tên Đối Tác');
                        const catIdx = colIdx('Phân Loại / Mặt Hàng');
                        const contactIdx = colIdx('Liên Hệ');
                        const addrIdx = colIdx('Địa Chỉ');
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[nameIdx]) return;
                            const isVendor = String(row[typeIdx]).trim() === 'NCC';
                            const id = row[idIdx] ? String(row[idIdx]).trim() : ((isVendor ? 'v' : 'c') + Date.now() + Math.random().toString().slice(2, 6));
                            if (isVendor) {
                                const vendor = {
                                    id,
                                    name: String(row[nameIdx]).trim(),
                                    type: String(row[catIdx] || '').trim(),
                                    contact: String(row[contactIdx] || '').trim(),
                                    address: String(row[addrIdx] || '').trim()
                                };
                                const existingIdx = AppData.state.vendors.findIndex(x => x.id === id);
                                if (existingIdx >= 0) AppData.state.vendors[existingIdx] = vendor;
                                else AppData.state.vendors.push(vendor);
                            } else {
                                const customer = {
                                    id,
                                    name: String(row[nameIdx]).trim(),
                                    contact: String(row[contactIdx] || '').trim(),
                                    address: String(row[addrIdx] || '').trim()
                                };
                                const existingIdx = AppData.state.customers.findIndex(x => x.id === id);
                                if (existingIdx >= 0) AppData.state.customers[existingIdx] = customer;
                                else AppData.state.customers.push(customer);
                            }
                        });
                        restoredSheets.push('Đối tác');
                    }
                }

                // 9. Tàu
                const wsVessels = workbook.Sheets['Tàu'];
                if (wsVessels) {
                    const rows = XLSX.utils.sheet_to_json(wsVessels, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        const idIdx = colIdx('Mã Tàu');
                        const nameIdx = colIdx('Tên Tàu');
                        const capIdx = colIdx('Trọng Tải (Tấn)');
                        const captainIdx = colIdx('Thuyền Trưởng');
                        const rateIdx = colIdx('Định Mức Dầu DO (L/h)');
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[idIdx] || !row[nameIdx]) return;
                            const id = String(row[idIdx]).trim();
                            const v = {
                                id,
                                name: String(row[nameIdx]).trim(),
                                capacity: Number(row[capIdx]) || 0,
                                captain: String(row[captainIdx] || '').trim(),
                                fuelRate: Number(row[rateIdx]) || 0
                            };
                            const existingIdx = AppData.state.vessels.findIndex(x => x.id === id);
                            if (existingIdx >= 0) AppData.state.vessels[existingIdx] = v;
                            else AppData.state.vessels.push(v);
                        });
                        restoredSheets.push('Tàu');
                    }
                }

                // 10. Thông tin công ty
                const wsComp = workbook.Sheets['Thông tin công ty'];
                if (wsComp) {
                    const rows = XLSX.utils.sheet_to_json(wsComp, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const row = rows[3];
                        if (row) {
                            const colIdx = (name) => headers.indexOf(name);
                            const nameIdx = colIdx('Tên Doanh Nghiệp');
                            const taxIdx = colIdx('Mã Số Thuế');
                            const bankIdx = colIdx('Thông Tin Ngân Hàng');
                            const addrIdx = colIdx('Địa Chỉ');
                            const abIdx = colIdx('Số Dư Đầu Kỳ ABbank (VNĐ)');
                            const vtIdx = colIdx('Số Dư Đầu Kỳ Viettinbank (VNĐ)');
                            const cnIdx = colIdx('Số Dư Đầu Kỳ Tài Khoản Cá Nhân (VNĐ)');
                            const tmIdx = colIdx('Số Dư Đầu Kỳ Tiền Mặt (VNĐ)');
                            
                            AppData.state.company = {
                                name: String(row[nameIdx] || '').trim(),
                                taxId: String(row[taxIdx] || '').trim(),
                                bankInfo: String(row[bankIdx] || '').trim(),
                                address: String(row[addrIdx] || '').trim(),
                                openingBalances: {
                                    ABbank: Number(row[abIdx]) || 0,
                                    Viettinbank: Number(row[vtIdx]) || 0,
                                    'Tài khoản cá nhân': Number(row[cnIdx]) || 0,
                                    'Tiền mặt': Number(row[tmIdx]) || 0
                                }
                            };
                        }
                        restoredSheets.push('Thông tin công ty');
                    }
                }

                // 11. Chi phí hàng năm
                const wsAnnual = workbook.Sheets['Chi phí hàng năm'];
                if (wsAnnual) {
                    const rows = XLSX.utils.sheet_to_json(wsAnnual, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        const yearIdx = colIdx('Năm');
                        const vesselIdx = colIdx('Mã Tàu');
                        const dockingIntCostIdx = colIdx('Lên Đà Trung Gian (VNĐ)');
                        const dockingIntYearsIdx = colIdx('Số Năm Phân Bổ (Trung Gian)');
                        const dockingIntDateIdx = colIdx('Lịch Lên Đà TG (YYYY-MM-DD)');
                        const dockingPerCostIdx = colIdx('Lên Đà Định Kỳ (VNĐ)');
                        const dockingPerYearsIdx = colIdx('Số Năm Phân Bổ (Định Kỳ)');
                        const dockingPerDateIdx = colIdx('Lịch Lên Đà ĐK (YYYY-MM-DD)');
                        const registryCostIdx = colIdx('Đăng Kiểm Hàng Năm (VNĐ)');
                        const registryYearsIdx = colIdx('Số Năm Phân Bổ (Đăng Kiểm)');
                        const registryDateIdx = colIdx('Lịch Đăng Kiểm (YYYY-MM-DD)');
                        const depreciationIdx = colIdx('Khấu Hao (VNĐ)');
                        const hullInsuranceIdx = colIdx('Bảo Hiểm Thân Vỏ (VNĐ)');
                        const largeRepairIdx = colIdx('Sửa Chữa Lớn (VNĐ)');
                        
                        if (!AppData.state.annualCosts) AppData.state.annualCosts = [];

                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[yearIdx] || !row[vesselIdx]) return;
                            const year = Number(row[yearIdx]);
                            const vesselId = String(row[vesselIdx]).trim();
                            const c = {
                                year,
                                vesselId,
                                dockingIntermediateCost: Number(row[dockingIntCostIdx]) || 0,
                                dockingIntermediateYears: Number(row[dockingIntYearsIdx]) || 2.5,
                                dockingIntermediateDate: row[dockingIntDateIdx] ? String(row[dockingIntDateIdx]).trim() : '',
                                dockingPeriodicCost: Number(row[dockingPerCostIdx]) || 0,
                                dockingPeriodicYears: Number(row[dockingPerYearsIdx]) || 5,
                                dockingPeriodicDate: row[dockingPerDateIdx] ? String(row[dockingPerDateIdx]).trim() : '',
                                registryAnnualCost: Number(row[registryCostIdx]) || 0,
                                registryAnnualYears: Number(row[registryYearsIdx]) || 1,
                                registryAnnualDate: row[registryDateIdx] ? String(row[registryDateIdx]).trim() : '',
                                depreciationCost: Number(row[depreciationIdx]) || 0,
                                hullInsuranceCost: Number(row[hullInsuranceIdx]) || 0,
                                largeRepairCost: largeRepairIdx >= 0 ? (Number(row[largeRepairIdx]) || 0) : 0
                            };
                            const existingIdx = AppData.state.annualCosts.findIndex(x => x.year === year && x.vesselId === vesselId);
                            if (existingIdx >= 0) AppData.state.annualCosts[existingIdx] = c;
                            else AppData.state.annualCosts.push(c);
                        });
                        restoredSheets.push('Chi phí hàng năm');
                    }
                }

                // Recalculate allocations for all modified vessel-months
                affectedAllocations.forEach(key => {
                    const [vesselId, monthStr] = key.split('_');
                    AppData.recalculateVesselAllocations(vesselId, monthStr);
                });

                // Run full system recalculation to apply all loaded annual and monthly costs
                AppData.recalculateAllShipments();

                if (restoredSheets.length === 0) {
                    alert('Không tìm thấy sheet hợp lệ nào để khôi phục!');
                    return;
                }

                AppData.save();
                alert('Khôi phục toàn bộ hệ thống thành công! Đã khôi phục các sheet: \n- ' + restoredSheets.join('\n- '));
                this.navigate('company');
            } catch (err) {
                console.error(err);
                alert('Lỗi khi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    exportShipmentReport() {
        if (typeof XLSX === 'undefined') return alert('Chưa tải xong thư viện xuất Excel!');
        const wb = XLSX.utils.book_new();
        const rows = [];
        
        rows.push(['BÁO CÁO CHI TIẾT TỔNG HỢP CHUYẾN HÀNG']);
        rows.push([]);
        rows.push([
            'ID Chuyến Hàng',
            'Số Hợp Đồng',
            'Chuyến Số',
            'Mã Tàu',
            'Khách Hàng',
            'Tên Hàng',
            'Cảng Xếp (Đi)',
            'Cảng Dỡ (Đến)',
            'Ngày Xếp Hàng',
            'Ngày Dỡ Hàng',
            'Tháng Hạch Toán',
            'Khối Lượng (Tấn)',
            'Đơn Giá Thực (VNĐ)',
            'Tiền Gửi (VND/tấn)',
            'Giá Dầu Chuyến (VNĐ)',
            'Số Giờ Chạy (Giờ)',
            'Doanh Thu Thực Tế (VNĐ)',
            'Doanh Thu Hóa Đơn (VNĐ)',
            'Tiền Gửi Lại Khách (VNĐ)',
            'Tiền Dầu DO (VNĐ)',
            'Tiền Dầu LO (VNĐ)',
            'Lương TV (VNĐ)',
            'Tiền Ăn (VNĐ)',
            'Bảo Hiểm (VNĐ)',
            'Vật Tư Cty Cấp (VNĐ)',
            'Vật Tư Tàu Chi (VNĐ)',
            'CP Khác Cty Cấp (VNĐ)',
            'Đại Lý 2 Đầu Cảng (VNĐ)',
            'Tàu Chi 2 Đầu Cảng (VNĐ)',
            'Tiền Bông (VNĐ)',
            'Thuế VAT (VNĐ)',
            'Hoa Tiêu, Tàu Lai, Phí Cảng (VNĐ)',
            'Chi Phí Khác Tàu Chi (VNĐ)',
            'Lên Đà Trung Gian (VNĐ)',
            'Lên Đà Định Kỳ (VNĐ)',
            'Đăng Kiểm Hàng Năm (VNĐ)',
            'Khấu Hao (VNĐ)',
            'Bảo Hiểm Thân Vỏ (VNĐ)',
            'Tổng Chi Phí (VNĐ)',
            'Lợi Nhuận/Hiệu Quả (VNĐ)'
        ]);
        
        let ships = AppData.getShipments();
        
        // Filter shipments based on active UI filters
        const filterMonth = this.lastShipmentsMonth || '';
        const filterYear = this.lastShipmentsYear || '';
        const filterVessel = this.lastShipmentsVessel || '';
        const filterCustomer = this.lastShipmentsCustomer || '';
        
        if (filterMonth) {
            ships = ships.filter(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (m && m.includes('-')) {
                    return m.split('-')[1] === filterMonth;
                }
                return false;
            });
        }
        if (filterYear) {
            ships = ships.filter(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (m && m.length >= 4) {
                    return m.substring(0, 4) === String(filterYear);
                }
                const date = s.dateStart || s.dateEnd;
                if (date) {
                    return new Date(date).getFullYear() === Number(filterYear);
                }
                return false;
            });
        }
        if (filterVessel) {
            ships = ships.filter(s => s.vesselId === filterVessel);
        }
        if (filterCustomer) {
            ships = ships.filter(s => s.customer === filterCustomer);
        }
        
        ships = ships.slice().sort((a, b) => {
            const numA = parseInt((a.contractNo || '').replace(/\D/g, '')) || 0;
            const numB = parseInt((b.contractNo || '').replace(/\D/g, '')) || 0;
            return numB - numA; // Descending by HD number
        });
            
        ships.forEach(s => {
            const qty = Number(s.qty || 0);
            const rate = Number(s.rate || 0);
            const markup = Number(s.markup || 0);
            const fuelPrice = Number(s.fuelPrice || 20000);
            const fuelHours = Number(s.fuelHours || 0);
            const revenueReal = Number(s.revenueReal || 0);
            const revenueInvoice = Number(s.revenueInvoice || 0);
            const refund = Number(s.refundAmount || 0);
            
            const costs = s.costs || {};
            const fuelDO = Number(costs.fuelDO || 0);
            const fuelLO = Number(costs.fuelLO || 0);
            const crewSalary = Number(costs.crewSalary || 0);
            const crewFood = Number(costs.crewFood || 0);
            const crewInsurance = Number(costs.crewInsurance || 0);
            const materialCompany = Number(costs.materialCompany || 0);
            const materialVessel = Number(costs.materialVessel || 0);
            const monthlyOther = Number(costs.monthlyOther || 0);
            const agent = Number(costs.agent || 0);
            const vessel2ends = Number(costs.vessel2ends || 0);
            const brokerage = Number(costs.brokerage || 0);
            const vat = Number(costs.vat || 0);
            const portFees = Number(costs.portFees || 0);
            const others = Number(costs.others || 0);
            const dockingIntermediate = this.excludeDockingDepreciation ? 0 : Number(costs.dockingIntermediate || 0);
            const dockingPeriodic = this.excludeDockingDepreciation ? 0 : Number(costs.dockingPeriodic || 0);
            const registryAnnual = Number(costs.registryAnnual || 0);
            const depreciation = this.excludeDockingDepreciation ? 0 : Number(costs.depreciation || 0);
            const hullInsurance = Number(costs.hullInsurance || 0);
            
            const totalExpenses = fuelDO + fuelLO + crewSalary + crewFood + crewInsurance + 
                                  materialCompany + materialVessel + monthlyOther + agent + 
                                  vessel2ends + brokerage + vat + portFees + others +
                                  dockingIntermediate + dockingPeriodic + registryAnnual + depreciation + hullInsurance;
            const profit = revenueReal - totalExpenses;
            
            rows.push([
                s.id || '',
                s.contractNo || '',
                s.voyageNo || '',
                s.vesselId || '',
                s.customer || '',
                s.cargo || '',
                s.portLoad || '',
                s.portDischarge || '',
                s.dateStart || '',
                s.dateEnd || '',
                s.reportMonth || '',
                qty,
                rate,
                markup,
                fuelPrice,
                fuelHours,
                revenueReal,
                revenueInvoice,
                refund,
                fuelDO,
                fuelLO,
                crewSalary,
                crewFood,
                crewInsurance,
                materialCompany,
                materialVessel,
                monthlyOther,
                agent,
                vessel2ends,
                brokerage,
                vat,
                portFees,
                others,
                dockingIntermediate,
                dockingPeriodic,
                registryAnnual,
                depreciation,
                hullInsurance,
                totalExpenses,
                profit
            ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            {wch: 15}, {wch: 12}, {wch: 10}, {wch: 8}, {wch: 25}, 
            {wch: 15}, {wch: 15}, {wch: 15}, {wch: 12}, {wch: 12}, 
            {wch: 12}, {wch: 15}, {wch: 18}, {wch: 15}, {wch: 18}, 
            {wch: 15}, {wch: 22}, {wch: 22}, {wch: 20}, {wch: 18}, 
            {wch: 18}, {wch: 18}, {wch: 15}, {wch: 15}, {wch: 18}, 
            {wch: 18}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 15}, 
            {wch: 15}, {wch: 20}, {wch: 18}, 
            {wch: 18}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 18}, // 5 new cols
            {wch: 20}, {wch: 22}
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Chuyen_Hang');
        XLSX.writeFile(wb, 'Bao_Cao_Chuyen_Hang_' + new Date().toISOString().slice(0,10) + '.xlsx');
    },

    getMonthlyVesselReportInputs(vesselId, monthStr) {
        const key = `monthly_vessel_report_inputs_${vesselId}_${monthStr}`;
        const stored = localStorage.getItem(key);
        let inputs = null;
        if (stored) {
            try {
                inputs = JSON.parse(stored);
            } catch (e) {
                console.error(e);
            }
        }
        if (!inputs) {
            inputs = {
                openingBalance: 0,
                customExpenses: [
                    { desc: 'Thuế TNDN 2025 tạm nộp', amount: 25000000 },
                    { desc: 'Chi phí VP', amount: 27482000 }
                ],
                overrides: {}
            };
        }
        if (!inputs.isManualOpening) {
            const prevMonthStr = this.getPreviousMonthStr(monthStr);
            inputs.openingBalance = this.calculateMonthlyClosingBalance(vesselId, prevMonthStr);
        }
        return inputs;
    },

    getPreviousMonthStr(monthStr) {
        if (!monthStr) return '';
        const [year, month] = monthStr.split('-').map(Number);
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }
        return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    },

    calculateMonthlyClosingBalance(vesselId, monthStr) {
        if (!monthStr) return 0;
        return this.doCalculateMonthlyClosingBalance(vesselId, monthStr, new Set());
    },

    doCalculateMonthlyClosingBalance(vesselId, monthStr, visitedMonths) {
        if (!monthStr || visitedMonths.has(monthStr) || visitedMonths.size > 24) {
            return 0; // Prevent infinite loop
        }
        visitedMonths.add(monthStr);

        const key = `monthly_vessel_report_inputs_${vesselId}_${monthStr}`;
        const stored = localStorage.getItem(key);
        let manualOpening = null;
        let customTotal = 0;
        let overrides = {};

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.isManualOpening) {
                    manualOpening = Number(parsed.openingBalance) || 0;
                }
                if (parsed.customExpenses) {
                    parsed.customExpenses.forEach(exp => {
                        customTotal += Number(exp.amount) || 0;
                    });
                }
                if (parsed.overrides) {
                    overrides = parsed.overrides;
                }
            } catch(e) {}
        }

        // 1. Opening balance
        let openingBalance = 0;
        if (manualOpening !== null) {
            openingBalance = manualOpening;
        } else {
            const prevMonthStr = this.getPreviousMonthStr(monthStr);
            openingBalance = this.doCalculateMonthlyClosingBalance(vesselId, prevMonthStr, visitedMonths);
        }

        // 2. Revenue
        const ships = AppData.getShipments();
        const shipments = ships.filter(s => {
            const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
            return s.vesselId === vesselId && m === monthStr;
        });
        const totalRevenueSum = shipments.reduce((sum, s) => {
            let sTotal = Number(s.revenueReal || 0);
            if (s.revenueInvoice > s.revenueReal) {
                const rate = s.commissionRate !== undefined ? s.commissionRate / 100 : ((s.contractNo === 'HD25' || s.contractNo === 'HD54') ? 0.20 : 0.28);
                sTotal += Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * rate);
            }
            return sum + sTotal;
        }, 0);

        // 3. Costs
        const [year, month] = monthStr.split('-').map(Number);
        const txs = (AppData.state.transactions || []).filter(t => t.vessel === vesselId && t.date && t.date.substring(0, 7) === monthStr);
        const doCost = overrides.doCost !== undefined ? Number(overrides.doCost) : AppData.state.fuelVoyages
            .filter(v => v.vesselId === vesselId && AppData.parseYearMonth(v.fuelDate) === monthStr)
            .reduce((sum, v) => sum + Math.round((Number(v.addedFuel) || 0) * (Number(v.fuelUnitPrice) || 0)), 0);

        const loCost = overrides.loCost !== undefined ? Number(overrides.loCost) : (AppData.state.loSupplies || []).filter(s => s.vesselId === vesselId && s.date && s.date.substring(0, 7) === monthStr)
            .reduce((sum, s) => sum + Math.round((Number(s.qty) || 0) * (Number(s.price) || 0)), 0);

        const vesselAdvances = overrides.advances !== undefined ? Number(overrides.advances) : txs.filter(t => t.category && (
            t.category === '1.Tàu Ứng' ||
            t.category === '1.Tàu ứng' ||
            t.category.trim().toLowerCase().includes('tàu ứng')
        )).reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        const monthlyCost = AppData.getMonthlyCosts(monthStr, vesselId);
        const crewSalary = overrides.salary !== undefined ? Number(overrides.salary) : (monthlyCost.salary || 0);

        const totalInterest = overrides.interest !== undefined ? Number(overrides.interest) : txs.filter(t => t.category === '6.Lãi Vay' || t.category === '6.Lại Vay').reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        const totalAgent = overrides.agent !== undefined ? Number(overrides.agent) : txs.filter(t => t.category === '2.Chi Phí Cảng').reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        const totalMaterial = overrides.material !== undefined ? Number(overrides.material) : txs.filter(t => t.category === '9.Vật Tư').reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        const daysInMonth = new Date(year, month, 0).getDate();
        const annualConfig = AppData.getAnnualCosts(year, vesselId);
        const hullInsurance = Math.round(daysInMonth * (annualConfig.hullInsuranceDaily || 0));
        const socialInsurance = monthlyCost.insurance || 0;
        const totalInsurance = overrides.insurance !== undefined ? Number(overrides.insurance) : (hullInsurance + socialInsurance);

        const autoVat = shipments.reduce((sum, s) => sum + (Number(s.costs?.vat) || 0), 0);
        const useVat = overrides.vat !== undefined ? Number(overrides.vat) : autoVat;

        const totalCostSum = doCost + loCost + vesselAdvances + crewSalary + totalInterest + totalAgent + totalMaterial + totalInsurance + useVat + customTotal;

        return openingBalance + totalRevenueSum - totalCostSum;
    },

    saveMonthlyVesselReportInputs(vesselId, monthStr, data) {
        const key = `monthly_vessel_report_inputs_${vesselId}_${monthStr}`;
        localStorage.setItem(key, JSON.stringify(data));
    },

    printShipmentReportDirectly(shipmentId) {
        const s = AppData.getShipment(shipmentId);
        if (!s) return alert('Không tìm thấy chuyến hàng!');
        
        const vessel = AppData.getVessel(s.vesselId);
        const vesselName = vessel ? vessel.name : s.vesselId;

        const rev = Number(s.revenueReal || 0);
        
        // Calculate VAT
        let vat = 0;
        if (s.revenueInvoice > s.revenueReal) {
            const rate = s.commissionRate !== undefined ? s.commissionRate / 100 : ((s.contractNo === 'HD25' || s.contractNo === 'HD54') ? 0.20 : 0.28);
            vat = Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * rate);
        }

        const fuelDO = Number(s.costs?.fuelDO || 0);
        const fuelLO = Number(s.costs?.fuelLO || 0);
        const crewSalary = Number(s.costs?.crewSalary || 0);
        const crewFood = Number(s.costs?.crewFood || 0);
        const crewInsurance = Number(s.costs?.crewInsurance || 0);
        const materialCompany = Number(s.costs?.materialCompany || 0);
        const materialVessel = Number(s.costs?.materialVessel || 0);
        const monthlyOther = Number(s.costs?.monthlyOther || 0);
        const agent = Number(s.costs?.agent || 0);
        const vessel2ends = Number(s.costs?.vessel2ends || 0);
        const brokerage = Number(s.costs?.brokerage || 0);
        const actualVat = Number(s.costs?.vat || 0);
        const portFees = Number(s.costs?.portFees || 0);
        const others = Number(s.costs?.others || 0);

        const vesselAdvances = (AppData.state.transactions || []).filter(t => t.vessel === s.vesselId && t.voyageNo === s.voyageNo && t.category && t.category.toLowerCase() === '1.tàu ứng').reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        const dockingIntermediate = this.excludeDockingDepreciation ? 0 : Number(s.costs?.dockingIntermediate || 0);
        const dockingPeriodic = this.excludeDockingDepreciation ? 0 : Number(s.costs?.dockingPeriodic || 0);
        const registryAnnual = Number(s.costs?.registryAnnual || 0);
        const depreciation = this.excludeDockingDepreciation ? 0 : Number(s.costs?.depreciation || 0);
        const hullInsurance = Number(s.costs?.hullInsurance || 0);
        const largeRepair = Number(s.costs?.largeRepair || 0);

        const loanInterest = Number(s.costs?.loanInterest || 0);
        const loanInterestExternal = Number(s.costs?.loanInterestExternal || 0);

        const totalExpenses = fuelDO + fuelLO + crewSalary + crewFood + crewInsurance + 
                              materialCompany + materialVessel + monthlyOther + agent + 
                              vessel2ends + brokerage + actualVat + portFees + others +
                              dockingIntermediate + dockingPeriodic + registryAnnual + depreciation + hullInsurance + largeRepair +
                              loanInterest + loanInterestExternal;

        const profit = rev - totalExpenses;

        const html = `
            <div class="print-container">
                <div class="print-actions no-print" style="margin-bottom: 1.5rem; text-align: right;">
                    <button class="btn btn-outline" onclick="app.closeModal('report-modal')" style="margin-right: 8px;">Đóng</button>
                    <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> In Báo Cáo</button>
                </div>
                <div class="print-header">
                    <h2>BÁO CÁO HẠNG MỤC CHI TIẾT CHUYẾN HÀNG</h2>
                    <p>Mã Hợp Đồng: <strong>${s.contractNo || '---'}</strong> | Số Chuyến: <strong>${s.voyageNo || '---'}</strong></p>
                </div>
                
                <table class="report-print-table" style="width: 100%; border-collapse: collapse; margin-top: 1rem; border: 1px solid #000;">
                    <thead>
                        <tr style="background: #cbd5e1; font-weight: bold; border: 1px solid #000;">
                            <th style="border: 1px solid #000; padding: 8px; text-align: left;">Hạng mục</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: right; width: 250px;">Số tiền (VNĐ)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="print-bold-row" style="background: #e2e8f0; font-weight: bold; border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px;">Doanh thu thực tế phát sinh trong tháng (1)</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #16a34a;">${AppData.formatCurrency(rev)}</td>
                        </tr>
                        <tr style="border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px; padding-left: 20px;">Doanh thu hóa đơn</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${AppData.formatCurrency(s.revenueInvoice || 0)}</td>
                        </tr>
                        <tr class="print-bold-row" style="background: #e2e8f0; font-weight: bold; border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px;">Thuế VAT tính thêm (2) = (Doanh thu HĐ - Thực tế)/1.08 * ${s.commissionRate !== undefined ? s.commissionRate : ((s.contractNo === 'HD25' || s.contractNo === 'HD54') ? 20 : 28)}%</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #16a34a;">${AppData.formatCurrency(vat)}</td>
                        </tr>
                        <tr class="print-bold-row" style="background: #cbd5e1; font-weight: bold; border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px;">TỔNG DOANH THU THU VỀ (3) = (1) + (2)</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #16a34a;">${AppData.formatCurrency(rev + vat)}</td>
                        </tr>
                        
                        <tr style="border: 1px solid #000; background: #f8fafc; font-weight: bold;">
                            <td style="border: 1px solid #000; padding: 8px;" colspan="2">CHI PHÍ CHUYẾN HÀNG</td>
                        </tr>
                        <tr style="border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px; padding-left: 20px;">Dầu DO cấp trong tháng</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #dc2626;">${AppData.formatCurrency(fuelDO)}</td>
                        </tr>
                        <tr style="border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px; padding-left: 20px;">Dầu LO cấp trong tháng</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #dc2626;">${AppData.formatCurrency(fuelLO)}</td>
                        </tr>
                        <tr style="border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px; padding-left: 20px;">Tàu chi (Tiền ứng 2 đầu cảng)</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #dc2626;">${AppData.formatCurrency(vesselAdvances + vessel2ends + monthlyOther + others)}</td>
                        </tr>
                        <tr style="border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px; padding-left: 20px;">Chi phí lương trong tháng</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #dc2626;">${AppData.formatCurrency(crewSalary)}</td>
                        </tr>
                        <tr style="border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px; padding-left: 20px;">Chi phí Cảng (Đại lý, lai dắt, hoa tiêu...)</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #dc2626;">${AppData.formatCurrency(agent + portFees)}</td>
                        </tr>
                        <tr style="border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px; padding-left: 20px;">Vật tư cấp tàu</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #dc2626;">${AppData.formatCurrency(materialCompany + materialVessel)}</td>
                        </tr>
                        <tr style="border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px; padding-left: 20px;">Bảo hiểm phân bổ (Tàu & BHXH)</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #dc2626;">${AppData.formatCurrency(crewInsurance + hullInsurance)}</td>
                        </tr>
                        <tr style="border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px; padding-left: 20px;">Tiền VAT thực tế nhập chuyến</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #dc2626;">${AppData.formatCurrency(actualVat)}</td>
                        </tr>
                        <tr style="border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px; padding-left: 20px;">Lại vay phân bổ chuyến (NH & Ngoài)</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #dc2626;">${AppData.formatCurrency(loanInterest + loanInterestExternal)}</td>
                        </tr>
                        <tr style="border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px; padding-left: 20px;">Chi phí lên đà, Đăng kiểm & Sửa chữa lớn phân bổ</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #dc2626;">${AppData.formatCurrency(dockingIntermediate + dockingPeriodic + registryAnnual + depreciation + largeRepair)}</td>
                        </tr>
                        <tr class="print-bold-row" style="background: #cbd5e1; font-weight: bold; border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px;">TỔNG CHI PHÍ CHUYẾN</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #dc2626;">${AppData.formatCurrency(totalExpenses)}</td>
                        </tr>
                        
                        <tr class="print-bold-row" style="background: #b91c1c; color: #fff; font-weight: bold; border: 1px solid #000;">
                            <td style="border: 1px solid #000; padding: 8px;">LỢI NHUẬN RÒNG THỰC TẾ</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${AppData.formatCurrency(profit)}</td>
                        </tr>
                    </tbody>
                </table>
                
                <div style="margin-top: 3rem; text-align: right; font-style: italic; font-size: 0.95rem;">
                    Báo cáo kết xuất tự động ngày ${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}
                </div>
            </div>
        `;
        document.getElementById('report-content').innerHTML = html;
        this.openModal('report-modal');
    },

    openShipmentReport(shipmentId) {
        this.printShipmentReportDirectly(shipmentId);
    },

    printMonthlyVesselReport(vesselId, monthStr, shouldPrint = false) {
        const vessel = AppData.getVessel(vesselId);
        const vesselName = vessel ? vessel.name : vesselId;
        const [year, month] = monthStr.split('-').map(Number);

        // Lấy danh sách chuyến của tàu trong tháng
        const shipments = AppData.getShipments().filter(s => {
            const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
            return s.vesselId === vesselId && m === monthStr;
        });

        // Sắp xếp theo số chuyến tăng dần
        const sortedShipments = shipments.slice().sort((a, b) => (a.voyageNo || '').localeCompare(b.voyageNo || ''));

        // Lấy tất cả giao dịch tài chính liên quan đến tàu này trong tháng
        const txs = (AppData.state.transactions || []).filter(t => t.vessel === vesselId && t.date && t.date.substring(0, 7) === monthStr);

        // Lấy chi phí dầu DO cấp trong tháng từ các đơn cấp dầu (fuelVoyages)
        const doCost = AppData.state.fuelVoyages.filter(v => v.vesselId === vesselId && AppData.parseYearMonth(v.fuelDate) === monthStr)
            .reduce((sum, v) => sum + Math.round((Number(v.addedFuel) || 0) * (Number(v.fuelUnitPrice) || 0)), 0);

        const loCost = (AppData.state.loSupplies || []).filter(s => s.vesselId === vesselId && s.date && s.date.substring(0, 7) === monthStr).reduce((sum, s) => sum + Math.round((Number(s.qty) || 0) * (Number(s.price) || 0)), 0);

        // Tàu chi
        const vesselAdvances = txs.filter(t => t.category && (
            t.category === '1.Tàu Ứng' ||
            t.category === '1.Tàu ứng' ||
            t.category.trim().toLowerCase().includes('tàu ứng')
        )).reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        // Lương
        const monthlyCost = AppData.getMonthlyCosts(monthStr, vesselId);
        const crewSalary = monthlyCost.salary || 0;

        // Lãi vay
        const interestTxs = txs.filter(t => t.category === '6.Lãi Vay');
        const totalInterest = interestTxs.reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        // Chi phí cảng
        const agentTxs = txs.filter(t => t.category === '2.Chi Phí Cảng');
        const totalAgent = agentTxs.reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        // Vật tư
        const materialTxs = txs.filter(t => t.category === '9.Vật Tư');
        const totalMaterial = materialTxs.reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        // Bảo hiểm
        const daysInMonth = new Date(year, month, 0).getDate();
        const annualConfig = AppData.getAnnualCosts(year, vesselId);
        const hullInsurance = Math.round(daysInMonth * (annualConfig.hullInsuranceDaily || 0));
        const socialInsurance = monthlyCost.insurance || 0;
        const totalInsurance = hullInsurance + socialInsurance;

        // VAT chuyến
        const totalVat = shipments.reduce((sum, s) => sum + (Number(s.costs?.vat) || 0), 0);

        // Dữ liệu tùy biến lưu ở localStorage
        const inputs = this.getMonthlyVesselReportInputs(vesselId, monthStr);
        this.activeReportVessel = vesselId;
        this.activeReportMonth = monthStr;

        let customTotal = 0;
        inputs.customExpenses.forEach(exp => {
            customTotal += Number(exp.amount) || 0;
        });

        // Tính doanh thu thực tế và tổng doanh thu sau VAT
        const totalRevenueSum = shipments.reduce((sum, s) => {
            let sTotal = Number(s.revenueReal || 0);
            if (s.revenueInvoice > s.revenueReal) {
                const rate = s.commissionRate !== undefined ? s.commissionRate / 100 : ((s.contractNo === 'HD25' || s.contractNo === 'HD54') ? 0.20 : 0.28);
                sTotal += Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * rate);
            }
            return sum + sTotal;
        }, 0);

        const totalCostSum = doCost + loCost + vesselAdvances + crewSalary + totalInterest + totalAgent + totalMaterial + totalInsurance + totalVat + customTotal;
        const finalBalance = (Number(inputs.openingBalance) || 0) + totalRevenueSum - totalCostSum;

        let html = `
            <div class="print-container" id="report-data-holder" 
                 data-do-cost="${doCost}" 
                 data-lo-cost="${loCost}" 
                 data-advances="${vesselAdvances}" 
                 data-salary="${crewSalary}" 
                 data-interest="${totalInterest}" 
                 data-agent="${totalAgent}" 
                 data-material="${totalMaterial}" 
                 data-insurance="${totalInsurance}" 
                 data-vat="${totalVat}" 
                 data-revenue="${totalRevenueSum}">
                 
                <div class="print-actions no-print" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                    <div>
                        <strong style="color: var(--primary-light);">Bảng Xem Trước & Điều Chỉnh Số Liệu</strong>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-outline" style="border-color: #10b981; color: #10b981;" onclick="app.exportMonthlyVesselReport('${vesselId}', '${monthStr}')">
                            <i class="fa-solid fa-file-excel"></i> Xuất Excel Báo Cáo Tháng
                        </button>
                        <button class="btn btn-outline" onclick="app.closeModal('report-modal')">Đóng</button>
                        <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> In A4</button>
                    </div>
                </div>
                
                <div class="print-header">
                    <h2>BẢNG THEO DÕI DOANH THU - CHI PHÍ TÀU ${vesselName.toUpperCase()}</h2>
                    <h3>THÁNG ${month}/${year}</h3>
                </div>
                
                <table class="report-print-table" style="width: 100%; border-collapse: collapse; margin-top: 1.5rem;">
                    <thead>
                        <tr style="background: #cbd5e1; font-weight: bold;">
                            <th class="print-action-cell" style="width: 40px;">Xóa</th>
                            <th style="width: 60px; text-align: center;">STT</th>
                            <th>CHI TIẾT HẠNG MỤC</th>
                            <th style="text-align: right; width: 140px;">DƯ ĐẦU THÁNG</th>
                            <th style="text-align: right; width: 140px;">DOANH THU</th>
                            <th style="text-align: right; width: 140px;">CHI PHÍ</th>
                            <th style="text-align: right; width: 140px;">TỒN CUỐI THÁNG</th>
                            <th style="width: 100px; text-align: center;">GHI CHÚ</th>
                        </tr>
                    </thead>
                    
                    <tbody>
                        <!-- Dư đầu tháng -->
                        <tr class="print-bold-row" style="background: #e2e8f0; font-weight: bold;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td>Tồn tháng trước chuyển sang</td>
                            <td style="text-align: right;">
                                <input type="number" id="rep-input-opening" class="print-input print-input-amount" value="${inputs.openingBalance}" oninput="app.recalcMonthlyVesselReport()" style="font-weight: bold; text-align: right;">
                            </td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                        
                        <!-- Doanh thu chuyến -->
                        ${sortedShipments.map(s => {
                            const qtyStr = Math.round(s.qty).toLocaleString('en-US');
                            const rateStr = Math.round(s.rate).toLocaleString('en-US');
                            const details = `HĐ ${s.contractNo || ''} ${vesselName} ${s.portLoad || ''} - ${s.portDischarge || ''} (${s.customer || ''}) ${qtyStr} * ${rateStr}`;
                            
                            let vatRow = '';
                            if (s.revenueInvoice > s.revenueReal) {
                                const rate = s.commissionRate !== undefined ? s.commissionRate / 100 : ((s.contractNo === 'HD25' || s.contractNo === 'HD54') ? 0.20 : 0.28);
                                const vatAmt = Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * rate);
                                vatRow = `
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td class="print-action-cell"></td>
                                        <td style="text-align: center;"></td>
                                        <td style="padding-left: 20px; color: #475569;">VAT tính thêm chuyến này (${s.markup ? Math.round(s.markup) : ''})</td>
                                        <td></td>
                                        <td style="text-align: right; color: #15803d; font-weight: 500;">${AppData.formatCurrency(vatAmt)}</td>
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                `;
                            }
                            
                            return `
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td class="print-action-cell"></td>
                                    <td style="text-align: center;"><strong>${s.voyageNo || ''}</strong></td>
                                    <td style="font-weight: 500;">${details}</td>
                                    <td></td>
                                    <td style="text-align: right; color: #15803d; font-weight: bold;">${AppData.formatCurrency(s.revenueReal)}</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                ${vatRow}
                            `;
                        }).join('')}
                        
                        <!-- Dầu DO & LO -->
                        <tr class="print-bold-row" style="background: #f1f5f9; font-weight: bold;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td>Nhiên liệu (Dầu DO & LO)</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right; color: #b91c1c;">${AppData.formatCurrency(doCost + loCost)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        <tr class="print-sub-row" style="border-bottom: 1px solid #f1f5f9;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td style="padding-left: 20px; color: #475569;">Dầu DO cấp trong tháng</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right;">${AppData.formatCurrency(doCost)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        <tr class="print-sub-row" style="border-bottom: 1px solid #f1f5f9;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td style="padding-left: 20px; color: #475569;">Dầu LO cấp trong tháng</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right;">${AppData.formatCurrency(loCost)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        
                        <!-- Tàu ứng -->
                        <tr class="print-bold-row" style="background: #f1f5f9; font-weight: bold; border-bottom: 1px solid #cbd5e1;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td>Tàu ứng chi phí trong tháng</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right; color: #b91c1c;">${AppData.formatCurrency(vesselAdvances)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        
                        <!-- Lương -->
                        <tr class="print-bold-row" style="background: #f1f5f9; font-weight: bold; border-bottom: 1px solid #cbd5e1;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td>Chi phí lương thủy thủ</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right; color: #b91c1c;">${AppData.formatCurrency(crewSalary)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        
                        <!-- Lãi vay -->
                        <tr class="print-bold-row" style="background: #f1f5f9; font-weight: bold;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td>Lãi vay phân bổ (Trong và ngoài ngân hàng)</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right; color: #b91c1c;">${AppData.formatCurrency(totalInterest)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        ${interestTxs.map(t => `
                            <tr class="print-sub-row" style="border-bottom: 1px solid #f1f5f9;">
                                <td class="print-action-cell"></td>
                                <td style="text-align: center;"></td>
                                <td style="padding-left: 20px; color: #475569;">${t.content || 'Lãi vay'}</td>
                                <td></td>
                                <td></td>
                                <td style="text-align: right;">${AppData.formatCurrency(t.chi)}</td>
                                <td></td>
                                <td></td>
                            </tr>
                        `).join('')}
                        
                        <!-- Chi phí Cảng -->
                        <tr class="print-bold-row" style="background: #f1f5f9; font-weight: bold;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td>Chi phí Cảng phát sinh</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right; color: #b91c1c;">${AppData.formatCurrency(totalAgent)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        ${agentTxs.map(t => `
                            <tr class="print-sub-row" style="border-bottom: 1px solid #f1f5f9;">
                                <td class="print-action-cell"></td>
                                <td style="text-align: center;"></td>
                                <td style="padding-left: 20px; color: #475569;">+ ${t.content || 'Chi phí cảng'}</td>
                                <td></td>
                                <td></td>
                                <td style="text-align: right;">${AppData.formatCurrency(t.chi)}</td>
                                <td></td>
                                <td></td>
                            </tr>
                        `).join('')}
                        
                        <!-- Vật tư -->
                        <tr class="print-bold-row" style="background: #f1f5f9; font-weight: bold;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td>Vật tư mua cấp tàu</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right; color: #b91c1c;">${AppData.formatCurrency(totalMaterial)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        ${materialTxs.map(t => `
                            <tr class="print-sub-row" style="border-bottom: 1px solid #f1f5f9;">
                                <td class="print-action-cell"></td>
                                <td style="text-align: center;"></td>
                                <td style="padding-left: 20px; color: #475569;">${t.content || 'Vật tư mua'}</td>
                                <td></td>
                                <td></td>
                                <td style="text-align: right;">${AppData.formatCurrency(t.chi)}</td>
                                <td></td>
                                <td></td>
                            </tr>
                        `).join('')}
                        
                        <!-- Bảo hiểm -->
                        <tr class="print-bold-row" style="background: #f1f5f9; font-weight: bold;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td>Bảo hiểm (Phân bổ bảo hiểm tàu & BHXH)</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right; color: #b91c1c;">${AppData.formatCurrency(totalInsurance)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        <tr class="print-sub-row" style="border-bottom: 1px solid #f1f5f9;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td style="padding-left: 20px; color: #475569;">Bảo hiểm thân vỏ phân bổ tháng (${daysInMonth} ngày)</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right;">${AppData.formatCurrency(hullInsurance)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        <tr class="print-sub-row" style="border-bottom: 1px solid #f1f5f9;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td style="padding-left: 20px; color: #475569;">Bảo hiểm xã hội tháng</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right;">${AppData.formatCurrency(socialInsurance)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        
                        <!-- VAT chuyến -->
                        <tr class="print-bold-row" style="background: #f1f5f9; font-weight: bold; border-bottom: 1px solid #cbd5e1;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td>Thuế VAT phát sinh chuyến trong tháng</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right; color: #b91c1c;">${AppData.formatCurrency(totalVat)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                    
                    <!-- Chi phí tự chọn thêm -->
                    <tbody id="rep-custom-expenses-body">
                        <tr style="background: #f8fafc; border-top: 2px solid #94a3b8; border-bottom: 2px solid #94a3b8;">
                            <td class="print-action-cell"></td>
                            <td colspan="7" style="font-weight: bold; padding: 6px;">Chi phí văn phòng, Thuế và các chi phí tự chọn khác:</td>
                        </tr>
                        ${inputs.customExpenses.map((exp, expIdx) => `
                            <tr class="custom-expense-row print-sub-row" style="border-bottom: 1px solid #e2e8f0;">
                                <td class="print-action-cell" style="text-align: center; width: 40px;">
                                    <button class="btn-delete-row" onclick="app.deleteReportCustomExpenseRow(this)"><i class="fa-solid fa-trash"></i></button>
                                </td>
                                <td style="text-align: center;"></td>
                                <td style="padding-left: 20px; color: #475569;">
                                    <input type="text" class="print-input-desc" value="${exp.desc || ''}" placeholder="Nhập tên chi phí tự chọn..." oninput="app.recalcMonthlyVesselReport()">
                                </td>
                                <td></td>
                                <td></td>
                                <td style="text-align: right; color: #b91c1c;">
                                    <input type="number" class="print-input print-input-amount" value="${exp.amount || 0}" oninput="app.recalcMonthlyVesselReport()" style="font-weight: bold; color: #b91c1c;">
                                </td>
                                <td></td>
                                <td></td>
                            </tr>
                        `).join('')}
                    </tbody>
                    
                    <tbody>
                        <tr class="no-print">
                            <td class="print-action-cell" style="border: none;"></td>
                            <td colspan="7" style="border: 1px solid #000000; padding: 8px; text-align: left; background: rgba(0,0,0,0.02);">
                                <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;" onclick="app.addReportCustomExpenseRow()">
                                    <i class="fa-solid fa-plus"></i> Thêm chi phí tự nhập khác (VP, Thuế...)
                                </button>
                            </td>
                        </tr>

                        <tr class="print-bold-row" style="background: #cbd5e1; border-top: 2px solid #000000;">
                            <td class="print-action-cell"></td>
                            <td style="text-align: center;"></td>
                            <td style="text-align: center; color: #1e3a8a; font-weight: bold; font-size: 1.05rem;">Cộng</td>
                            <td style="text-align: right; color: #1e3a8a; font-weight: bold;" id="rep-total-opening">${AppData.formatCurrency(inputs.openingBalance)}</td>
                            <td style="text-align: right; color: #15803d; font-weight: bold;" id="rep-total-revenue">${AppData.formatCurrency(totalRevenueSum)}</td>
                            <td style="text-align: right; color: #b91c1c; font-weight: bold;" id="rep-total-cost">${AppData.formatCurrency(totalCostSum)}</td>
                            <td style="text-align: right; color: #15803d; font-weight: bold; font-size: 1.1rem;" id="rep-total-balance">${AppData.formatCurrency(finalBalance)}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
                
                <div style="margin-top: 3rem; text-align: right; font-style: italic; font-size: 0.95rem;">
                    Lập ngày ${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}
                </div>
                
                <div class="no-print" style="margin-top: 2rem; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 1.5rem;">
                    <button class="btn btn-outline" onclick="app.closeModal('report-modal')" style="margin-right: 10px;">Đóng Báo Cáo</button>
                    <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> In Báo Cáo</button>
                </div>
            </div>
        `;
        document.getElementById('report-content').innerHTML = html;
        this.openModal('report-modal');
        if (shouldPrint) {
            setTimeout(() => {
                window.print();
            }, 300);
        }
    },

    recalcMonthlyVesselReport() {
        const holder = document.getElementById('report-data-holder');
        if (!holder) return;

        const vesselId = this.activeReportVessel;
        const monthStr = this.activeReportMonth;
        if (!vesselId || !monthStr) return;

        const opening = Number(document.getElementById('rep-input-opening').value) || 0;
        
        const rows = document.querySelectorAll('.custom-expense-row');
        let customTotal = 0;
        const customExpenses = [];
        rows.forEach(row => {
            const desc = row.querySelector('.print-input-desc').value.trim();
            const amount = Number(row.querySelector('.print-input-amount').value) || 0;
            customTotal += amount;
            if (desc) {
                customExpenses.push({ desc, amount });
            }
        });

        const data = {
            openingBalance: opening,
            customExpenses: customExpenses
        };
        this.saveMonthlyVesselReportInputs(vesselId, monthStr, data);

        const doCost = Number(holder.dataset.doCost) || 0;
        const loCost = Number(holder.dataset.loCost) || 0;
        const vesselAdvances = Number(holder.dataset.advances) || 0;
        const crewSalary = Number(holder.dataset.salary) || 0;
        const totalInterest = Number(holder.dataset.interest) || 0;
        const totalAgent = Number(holder.dataset.agent) || 0;
        const totalMaterial = Number(holder.dataset.material) || 0;
        const totalInsurance = Number(holder.dataset.insurance) || 0;
        const totalVat = Number(holder.dataset.vat) || 0;
        const totalRevenueSum = Number(holder.dataset.revenue) || 0;

        const totalCostSum = doCost + loCost + vesselAdvances + crewSalary + totalInterest + totalAgent + totalMaterial + totalInsurance + totalVat + customTotal;
        const finalBalance = opening + totalRevenueSum - totalCostSum;

        document.getElementById('rep-total-opening').innerText = AppData.formatCurrency(opening);
        document.getElementById('rep-total-cost').innerText = AppData.formatCurrency(totalCostSum);
        document.getElementById('rep-total-balance').innerText = AppData.formatCurrency(finalBalance);
    },

    addReportCustomExpenseRow() {
        const tbody = document.getElementById('rep-custom-expenses-body');
        if (tbody) {
            const tr = document.createElement('tr');
            tr.className = 'custom-expense-row print-sub-row';
            tr.innerHTML = `
                <td class="print-action-cell" style="text-align: center; width: 40px; border: 1px solid #000000;">
                    <button class="btn-delete-row" onclick="app.deleteReportCustomExpenseRow(this)"><i class="fa-solid fa-trash"></i></button>
                </td>
                <td style="text-align: center;"></td>
                <td style="padding-left: 20px; color: #475569;">
                    <input type="text" class="print-input-desc" value="" placeholder="Nhập tên chi phí tự chọn..." oninput="app.recalcMonthlyVesselReport()">
                </td>
                <td></td>
                <td></td>
                <td style="text-align: right; color: #b91c1c;">
                    <input type="number" class="print-input print-input-amount" value="0" oninput="app.recalcMonthlyVesselReport()" style="font-weight: bold; color: #b91c1c;">
                </td>
                <td></td>
                <td></td>
            `;
            tbody.appendChild(tr);
            this.recalcMonthlyVesselReport();
        }
    },

    deleteReportCustomExpenseRow(btn) {
        const tr = btn.closest('tr');
        if (tr) {
            tr.remove();
            this.recalcMonthlyVesselReport();
        }
    },

    // === Inline Monthly Report (Báo cáo Tháng tab) helpers ===
    recalcInlineMonthlyReport() {
        const dataDiv = document.getElementById('monthly-report-data');
        if (!dataDiv) return;

        const doCost = Number(dataDiv.dataset.doCost) || 0;
        const loCost = Number(dataDiv.dataset.loCost) || 0;
        const vesselAdvances = Number(dataDiv.dataset.advances) || 0;
        const crewSalary = Number(dataDiv.dataset.salary) || 0;
        const totalInterest = Number(dataDiv.dataset.interest) || 0;
        const totalAgent = Number(dataDiv.dataset.agent) || 0;
        const totalMaterial = Number(dataDiv.dataset.material) || 0;
        const totalInsurance = Number(dataDiv.dataset.insurance) || 0;
        const vatForCost = Number(dataDiv.dataset.vat) || 0;
        const totalRevenueSum = Number(dataDiv.dataset.revenue) || 0;

        // Read cost inputs overrides
        const costInputs = document.querySelectorAll('.mi-cost-input');
        const overrides = {};
        costInputs.forEach(input => {
            const field = input.getAttribute('data-field');
            const autoVal = Number(input.getAttribute('data-auto')) || 0;
            const currentVal = Number(input.value) || 0;
            
            const button = input.previousElementSibling; // The reset button
            if (currentVal !== autoVal) {
                overrides[field] = currentVal;
                input.style.color = '#fbbf24'; // yellow
                if (button) button.style.color = '#fbbf24';
            } else {
                input.style.color = '#f87171'; // light red
                if (button) button.style.color = '#64748b';
            }
        });

        const doCostVal = overrides.doCost !== undefined ? overrides.doCost : doCost;
        const loCostVal = overrides.loCost !== undefined ? overrides.loCost : loCost;
        const advancesVal = overrides.advances !== undefined ? overrides.advances : vesselAdvances;
        const salaryVal = overrides.salary !== undefined ? overrides.salary : crewSalary;
        const interestVal = overrides.interest !== undefined ? overrides.interest : totalInterest;
        const agentVal = overrides.agent !== undefined ? overrides.agent : totalAgent;
        const materialVal = overrides.material !== undefined ? overrides.material : totalMaterial;
        // Tính tổng bảo hiểm: nếu nhập tay hullInsurance hoặc socialInsurance thì cộng 2 ô con;
        // nếu nhập tay trực tiếp ô insurance (tổng) thì dùng giá trị đó; ngược lại dùng giá trị tự động.
        const hullInsInput   = document.getElementById('mi-cost-hullInsurance');
        const socialInsInput = document.getElementById('mi-cost-socialInsurance');
        const autoHullIns   = hullInsInput   ? (Number(hullInsInput.getAttribute('data-auto'))   || 0) : 0;
        const autoSocialIns = socialInsInput ? (Number(socialInsInput.getAttribute('data-auto')) || 0) : 0;
        const hullInsVal    = overrides.hullInsurance   !== undefined ? overrides.hullInsurance   : autoHullIns;
        const socialInsVal  = overrides.socialInsurance !== undefined ? overrides.socialInsurance : autoSocialIns;
        let insuranceVal;
        if (overrides.insurance !== undefined) {
            insuranceVal = overrides.insurance;
        } else if (overrides.hullInsurance !== undefined || overrides.socialInsurance !== undefined) {
            insuranceVal = hullInsVal + socialInsVal;
        } else {
            insuranceVal = totalInsurance;
        }
        const vatVal = overrides.vat !== undefined ? overrides.vat : vatForCost;

        const openingInput = document.getElementById('mi-rep-opening');
        const opening = openingInput ? (Number(openingInput.value) || 0) : 0;

        let isManualOpening = false;
        if (this.activeReportVessel && this.activeReportMonth) {
            const prevMonthStr = this.getPreviousMonthStr(this.activeReportMonth);
            const autoOpening = this.calculateMonthlyClosingBalance(this.activeReportVessel, prevMonthStr);
            const button = openingInput ? openingInput.previousElementSibling : null;
            if (Math.abs(opening - autoOpening) > 0.01) {
                isManualOpening = true;
                if (openingInput) openingInput.style.color = '#fbbf24'; // yellow
                if (button) button.style.color = '#fbbf24';
            } else {
                if (openingInput) openingInput.style.color = ''; // inherit
                if (button) button.style.color = '#64748b';
            }
        }

        const rows = document.querySelectorAll('.mi-custom-expense-row');
        let customTotal = 0;
        const customExpenses = [];
        rows.forEach(row => {
            const descEl = row.querySelector('.mi-custom-desc');
            const amtEl = row.querySelector('.mi-custom-amount');
            const desc = descEl ? descEl.value.trim() : '';
            const amount = amtEl ? (Number(amtEl.value) || 0) : 0;
            customTotal += amount;
            customExpenses.push({ desc, amount });
        });

        // Save for persistence
        if (this.activeReportVessel && this.activeReportMonth) {
            this.saveMonthlyVesselReportInputs(this.activeReportVessel, this.activeReportMonth, {
                openingBalance: opening,
                customExpenses,
                overrides,
                isManualOpening
            });
        }

        const totalCostSum = doCostVal + loCostVal + advancesVal + salaryVal + interestVal + agentVal + materialVal + insuranceVal + vatVal + customTotal;
        const finalBalance = opening + totalRevenueSum - totalCostSum;

        const elOpening   = document.getElementById('mi-rep-total-opening');
        const elCost      = document.getElementById('mi-rep-total-cost');
        const elBalance   = document.getElementById('mi-rep-total-balance');
        const elInsurance = document.getElementById('mi-display-insurance');
        if (elOpening)   elOpening.innerText   = AppData.formatCurrency(opening);
        if (elCost)      elCost.innerText      = AppData.formatCurrency(totalCostSum);
        if (elBalance)   elBalance.innerText   = AppData.formatCurrency(finalBalance);
        // Cập nhật dòng tổng Bảo hiểm theo giá trị vừa tính
        if (elInsurance) elInsurance.innerText = AppData.formatCurrency(insuranceVal);
    },

    resetMICostField(fieldId, autoVal) {
        const input = document.getElementById(`mi-cost-${fieldId}`);
        if (input) {
            input.value = autoVal;
            if (this.activeReportVessel && this.activeReportMonth) {
                const inputs = this.getMonthlyVesselReportInputs(this.activeReportVessel, this.activeReportMonth);
                if (inputs.overrides) {
                    delete inputs.overrides[fieldId];
                    this.saveMonthlyVesselReportInputs(this.activeReportVessel, this.activeReportMonth, inputs);
                }
            }
            this.recalcInlineMonthlyReport();
        }
    },

    resetMIOpeningField() {
        if (this.activeReportVessel && this.activeReportMonth) {
            const inputs = this.getMonthlyVesselReportInputs(this.activeReportVessel, this.activeReportMonth);
            delete inputs.isManualOpening;
            this.saveMonthlyVesselReportInputs(this.activeReportVessel, this.activeReportMonth, inputs);
            
            const prevMonthStr = this.getPreviousMonthStr(this.activeReportMonth);
            const autoOpening = this.calculateMonthlyClosingBalance(this.activeReportVessel, prevMonthStr);
            const input = document.getElementById('mi-rep-opening');
            if (input) {
                input.value = autoOpening;
                input.style.color = '';
            }
            this.recalcInlineMonthlyReport();
        }
    },

    addMICustomRow() {
        const tbody = document.getElementById('mi-rep-custom-body');
        if (!tbody) return;
        const tr = document.createElement('tr');
        tr.className = 'mi-custom-expense-row';
        tr.innerHTML = `
            <td style="text-align: center; padding: 6px 4px; border: 1px solid #4a5568;">
                <button class="btn-delete-row no-print" style="background:none;border:none;cursor:pointer;color:#f87171;" onclick="app.deleteMICustomRow(this)"><i class="fa-solid fa-trash"></i></button>
            </td>
            <td style="padding: 6px 8px 6px 24px; border: 1px solid #4a5568; color: #94a3b8;">
                <input type="text" class="mi-custom-desc" value="" placeholder="Nhập tên chi phí..." oninput="app.recalcInlineMonthlyReport()" style="width:100%;background:transparent;border:none;color:inherit;font-size:inherit;">
            </td>
            <td style="border: 1px solid #4a5568;"></td>
            <td style="border: 1px solid #4a5568;"></td>
            <td style="text-align: right; padding: 6px 8px; border: 1px solid #4a5568; color: #f87171;">
                <input type="number" class="mi-custom-amount" value="0" oninput="app.recalcInlineMonthlyReport()" style="text-align:right;width:100%;background:transparent;border:none;color:inherit;font-size:inherit;font-weight:bold;">
            </td>
            <td style="border: 1px solid #4a5568;"></td>
            <td style="border: 1px solid #4a5568;"></td>
        `;
        tbody.appendChild(tr);
        this.recalcInlineMonthlyReport();
    },

    deleteMICustomRow(btn) {
        const tr = btn.closest('tr');
        if (tr) {
            tr.remove();
            this.recalcInlineMonthlyReport();
        }
    },

    exportMonthlyVesselReport(vesselId, monthStr) {
        if (typeof XLSX === 'undefined') return alert('Chưa tải xong thư viện xuất Excel!');
        
        const vessel = AppData.getVessel(vesselId);
        const vesselName = vessel ? vessel.name : vesselId;
        const [year, month] = monthStr.split('-').map(Number);
        
        const shipments = AppData.getShipments().filter(s => {
            const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
            return s.vesselId === vesselId && m === monthStr;
        });
        const sortedShipments = shipments.slice().sort((a,b) => (a.voyageNo || '').localeCompare(b.voyageNo || ''));
        
        const txs = (AppData.state.transactions || []).filter(t => t.vessel === vesselId && t.date && t.date.substring(0, 7) === monthStr);
        
        const doCost = AppData.state.fuelVoyages.filter(v => v.vesselId === vesselId && AppData.parseYearMonth(v.fuelDate) === monthStr)
            .reduce((sum, v) => sum + Math.round((Number(v.addedFuel) || 0) * (Number(v.fuelUnitPrice) || 0)), 0);

        const loCost = (AppData.state.loSupplies || []).filter(s => s.vesselId === vesselId && s.date && s.date.substring(0, 7) === monthStr).reduce((sum, s) => sum + Math.round((Number(s.qty) || 0) * (Number(s.price) || 0)), 0);
        
        const vesselAdvances = txs.filter(t => t.category && (
            t.category === '1.Tàu Ứng' ||
            t.category === '1.Tàu ứng' ||
            t.category.trim().toLowerCase().includes('tàu ứng')
        )).reduce((sum, t) => sum + (Number(t.chi) || 0), 0);
        const monthlyCost = AppData.getMonthlyCosts(monthStr, vesselId);
        const crewSalary = monthlyCost.salary || 0;
        
        const interestTxs = txs.filter(t => t.category === '6.Lại Vay' || t.category === '6.Lãi Vay');
        const totalInterest = interestTxs.reduce((sum, t) => sum + (Number(t.chi) || 0), 0);
        
        const agentTxs = txs.filter(t => t.category === '2.Chi Phí Cảng');
        const totalAgent = agentTxs.reduce((sum, t) => sum + (Number(t.chi) || 0), 0);
        
        const materialTxs = txs.filter(t => t.category === '9.Vật Tư');
        const totalMaterial = materialTxs.reduce((sum, t) => sum + (Number(t.chi) || 0), 0);
        
        const daysInMonth = new Date(year, month, 0).getDate();
        const annualConfig = AppData.getAnnualCosts(year, vesselId);
        const hullInsurance = Math.round(daysInMonth * (annualConfig.hullInsuranceDaily || 0));
        const socialInsurance = monthlyCost.insurance || 0;
        const totalInsurance = hullInsurance + socialInsurance;
        
        const totalVat = shipments.reduce((sum, s) => sum + (Number(s.costs?.vat) || 0), 0);
        
        const inputs = this.getMonthlyVesselReportInputs(vesselId, monthStr);
        let customTotal = 0;
        inputs.customExpenses.forEach(exp => {
            customTotal += Number(exp.amount) || 0;
        });
        
        const totalRevenueSum = shipments.reduce((sum, s) => {
            let sTotal = Number(s.revenueReal || 0);
            if (s.revenueInvoice > s.revenueReal) {
                const rate = s.commissionRate !== undefined ? s.commissionRate / 100 : ((s.contractNo === 'HD25' || s.contractNo === 'HD54') ? 0.20 : 0.28);
                sTotal += Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * rate);
            }
            return sum + sTotal;
        }, 0);
        
        const totalCostSum = doCost + loCost + vesselAdvances + crewSalary + totalInterest + totalAgent + totalMaterial + totalInsurance + totalVat + customTotal;
        const finalBalance = (Number(inputs.openingBalance) || 0) + totalRevenueSum - totalCostSum;
        
        const wb = XLSX.utils.book_new();
        const rows = [];
        
        // 1. Tiêu đề
        rows.push([`BẢNG THEO DÕI DOANH THU - CHI PHÍ TÀU ${vesselName.toUpperCase()}`]);
        rows.push([`THÁNG ${month}/${year}`]);
        rows.push([]);
        
        // 2. Header bảng
        rows.push(['STT', 'CHI TIẾT HẠNG MỤC', 'DƯ ĐẦU THÁNG', 'DOANH THU', 'CHI PHÍ', 'TỒN CUỐI THÁNG', 'GHI CHÚ']);
        
        // Dư đầu tháng
        rows.push(['', 'Tồn tháng trước chuyển sang', Number(inputs.openingBalance) || 0, '', '', '', '']);
        
        // Doanh thu chuyến
        sortedShipments.forEach(s => {
            const qtyStr = Math.round(s.qty).toLocaleString('en-US');
            const rateStr = Math.round(s.rate).toLocaleString('en-US');
            const details = `HĐ ${s.contractNo || ''} ${vesselName} ${s.portLoad || ''} - ${s.portDischarge || ''} (${s.customer || ''}) ${qtyStr} * ${rateStr}`;
            
            rows.push([
                s.voyageNo || '',
                details,
                '',
                Number(s.revenueReal) || 0,
                '',
                '',
                ''
            ]);
            
            if (s.revenueInvoice > s.revenueReal) {
                const rate = s.commissionRate !== undefined ? s.commissionRate / 100 : ((s.contractNo === 'HD25' || s.contractNo === 'HD54') ? 0.20 : 0.28);
                const vatAmt = Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * rate);
                rows.push([
                    '',
                    `VAT tính thêm chuyến này (${s.markup ? Math.round(s.markup) : ''})`,
                    '',
                    vatAmt,
                    '',
                    '',
                    ''
                ]);
            }
        });
        
        // Chi phí
        // Nhiên liệu DO & LO
        rows.push(['', 'Nhiên liệu (Dầu DO & LO)', '', '', doCost + loCost, '', '']);
        rows.push(['', '  Dầu DO cấp trong tháng', '', '', doCost || 0, '', '']);
        rows.push(['', '  Dầu LO cấp trong tháng', '', '', loCost || 0, '', '']);
        
        // Tàu ứng chi phí
        rows.push(['', 'Tàu ứng chi phí trong tháng', '', '', vesselAdvances || 0, '', '']);
        
        // Lương
        rows.push(['', 'Chi phí lương thủy thủ', '', '', crewSalary || 0, '', '']);
        
        // Lãi vay
        rows.push(['', 'Lãi vay phân bổ', '', '', totalInterest || 0, '', '']);
        interestTxs.forEach(t => {
            rows.push(['', `  ${t.content || 'Lãi vay'}`, '', '', Number(t.chi) || 0, '', '']);
        });
        
        // Đại lý / Chi phí cảng
        rows.push(['', 'Chi phí Cảng phát sinh', '', '', totalAgent || 0, '', '']);
        agentTxs.forEach(t => {
            rows.push(['', `  + ${t.content || 'Chi phí cảng'}`, '', '', Number(t.chi) || 0, '', '']);
        });
        
        // Vật tư
        rows.push(['', 'Vật tư mua cấp tàu', '', '', totalMaterial || 0, '', '']);
        materialTxs.forEach(t => {
            rows.push(['', `  ${t.content || 'Vật tư'}`, '', '', Number(t.chi) || 0, '', '']);
        });
        
        // Bảo hiểm
        rows.push(['', 'Bảo hiểm (Phân bổ BH tàu & BHXH)', '', '', totalInsurance || 0, '', '']);
        rows.push(['', '  Bảo hiểm thân vỏ phân bổ', '', '', hullInsurance || 0, '', '']);
        rows.push(['', '  Bảo hiểm xã hội', '', '', socialInsurance || 0, '', '']);
        
        // VAT
        rows.push(['', 'Thuế VAT phát sinh chuyến trong tháng', '', '', totalVat || 0, '', '']);
        
        // Chi phí khác
        rows.push(['', 'Chi phí văn phòng, Thuế và khác', '', '', customTotal || 0, '', '']);
        inputs.customExpenses.forEach(exp => {
            rows.push(['', `  ${exp.desc}`, '', '', Number(exp.amount) || 0, '', '']);
        });
        
        // Cộng tổng
        rows.push([
            '',
            'Cộng',
            Number(inputs.openingBalance) || 0,
            totalRevenueSum || 0,
            totalCostSum || 0,
            finalBalance || 0,
            ''
        ]);
        
        // Ngày lập báo cáo
        rows.push([]);
        const today = new Date();
        const todayStr = `Lập ngày ${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        rows.push(['', '', '', '', '', todayStr, '']);
        
        const ws = XLSX.utils.aoa_to_sheet(rows);
        
        // Cấu hình định dạng số & Độ rộng cột
        for (let key in ws) {
            if (key[0] === '!') continue;
            const cell = ws[key];
            if (typeof cell.v === 'number') {
                cell.t = 'n';
                cell.z = '#,##0'; // Giữ số tiền đầy đủ, phân tích hàng nghìn
            }
        }
        
        ws['!cols'] = [
            { wch: 8 },  // STT
            { wch: 55 }, // CHI TIẾT
            { wch: 18 }, // DƯ ĐẦU THÁNG
            { wch: 18 }, // DOANH THU
            { wch: 18 }, // CHI PHÍ
            { wch: 18 }, // TỒN CUỐI THÁNG
            { wch: 15 }  // GHI CHÚ
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Theo doi DT_CP');
        XLSX.writeFile(wb, `Bao_Cao_DT_CP_Tau_${vesselName}_Thang_${month}_${year}.xlsx`);
    },

    exportYearSummaryReport(year) {
        if (typeof XLSX === 'undefined') return alert('Chưa tải xong thư viện xuất Excel!');
        
        const vessels = AppData.getVessels();
        const ships = AppData.getShipments().filter(s => s.contractNo && s.contractNo.trim() !== '');
        
        const data = [];
        data.push([
            'Tháng', 'Tàu', 'Doanh thu (VNĐ)', 'Dầu DO (VNĐ)', 'Dầu LO (VNĐ)', 
            'Chi phí cảng (VNĐ)', 'Tàu ứng (VNĐ)', 'Lương (VNĐ)', 'Lãi vay (VNĐ)', 
            'Bảo hiểm (VNĐ)', 'Thuế VAT (VNĐ)', 'Vật tư (VNĐ)', 'Chi phí khác (VNĐ)', 
            'Tổng chi phí (VNĐ)', 'Lợi nhuận (VNĐ)'
        ]);

        let yearTotalRevenue = 0;
        let yearTotalDO = 0;
        let yearTotalLO = 0;
        let yearTotalAgent = 0;
        let yearTotalAdvances = 0;
        let yearTotalSalary = 0;
        let yearTotalInterest = 0;
        let yearTotalInsurance = 0;
        let yearTotalVat = 0;
        let yearTotalMaterial = 0;
        let yearTotalOther = 0;
        let yearTotalCost = 0;
        let yearTotalClosing = 0;

        for (let m = 1; m <= 12; m++) {
            const monthStr = `${year}-${String(m).padStart(2, '0')}`;
            let hasData = false;
            
            vessels.forEach(v => {
                const shipments = ships.some(s => {
                    const sm = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                    return s.vesselId === v.id && sm === monthStr;
                });
                if (shipments) hasData = true;
                const txs = (AppData.state.transactions || []).some(t => t.vessel === v.id && t.date && t.date.substring(0, 7) === monthStr);
                if (txs) hasData = true;
                const fuel = AppData.state.fuelVoyages.some(fv => fv.vesselId === v.id && AppData.parseYearMonth(fv.fuelDate) === monthStr);
                if (fuel) hasData = true;
                const monthlyCost = AppData.getMonthlyCosts(monthStr, v.id);
                if (monthlyCost && (monthlyCost.salary || monthlyCost.insurance)) hasData = true;
            });

            if (!hasData) continue;

            let monthSubRevenue = 0;
            let monthSubDO = 0;
            let monthSubLO = 0;
            let monthSubAgent = 0;
            let monthSubAdvances = 0;
            let monthSubSalary = 0;
            let monthSubInterest = 0;
            let monthSubInsurance = 0;
            let monthSubVat = 0;
            let monthSubMaterial = 0;
            let monthSubOther = 0;
            let monthSubCost = 0;
            let monthSubClosing = 0;

            vessels.forEach(v => {
                const breakdown = this.getMonthlyVesselReportBreakdown(v.id, monthStr);
                const monthlyBalance = breakdown.revenue - breakdown.totalCost;

                monthSubRevenue += breakdown.revenue;
                monthSubDO += breakdown.doCost;
                monthSubLO += breakdown.loCost;
                monthSubAgent += breakdown.agent;
                monthSubAdvances += breakdown.advances;
                monthSubSalary += breakdown.salary;
                monthSubInterest += breakdown.interest;
                monthSubInsurance += breakdown.insurance;
                monthSubVat += breakdown.vat;
                monthSubMaterial += breakdown.material;
                monthSubOther += breakdown.other;
                monthSubCost += breakdown.totalCost;
                monthSubClosing += monthlyBalance;

                data.push([
                    `Tháng ${m}`, v.id, breakdown.revenue, breakdown.doCost, breakdown.loCost,
                    breakdown.agent, breakdown.advances, breakdown.salary, breakdown.interest,
                    breakdown.insurance, breakdown.vat, breakdown.material, breakdown.other,
                    breakdown.totalCost, monthlyBalance
                ]);
            });

            data.push([
                `Cộng Tháng ${m}`, '', monthSubRevenue, monthSubDO, monthSubLO,
                monthSubAgent, monthSubAdvances, monthSubSalary, monthSubInterest,
                monthSubInsurance, monthSubVat, monthSubMaterial, monthSubOther,
                monthSubCost, monthSubClosing
            ]);

            yearTotalRevenue += monthSubRevenue;
            yearTotalDO += monthSubDO;
            yearTotalLO += monthSubLO;
            yearTotalAgent += monthSubAgent;
            yearTotalAdvances += monthSubAdvances;
            yearTotalSalary += monthSubSalary;
            yearTotalInterest += monthSubInterest;
            yearTotalInsurance += monthSubInsurance;
            yearTotalVat += monthSubVat;
            yearTotalMaterial += monthSubMaterial;
            yearTotalOther += monthSubOther;
            yearTotalCost += monthSubCost;
            yearTotalClosing += monthSubClosing;
        }

        data.push([
            `TỔNG CỘNG NĂM ${year}`, '', yearTotalRevenue, yearTotalDO, yearTotalLO,
            yearTotalAgent, yearTotalAdvances, yearTotalSalary, yearTotalInterest,
            yearTotalInsurance, yearTotalVat, yearTotalMaterial, yearTotalOther,
            yearTotalCost, yearTotalClosing
        ]);

        const ws = XLSX.utils.aoa_to_sheet(data);
        
        for (let key in ws) {
            if (key[0] === '!') continue;
            const cell = ws[key];
            if (typeof cell.v === 'number') {
                cell.t = 'n';
                cell.z = '#,##0';
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Năm ${year}`);
        
        const wscols = data[0].map((_, i) => {
            let maxLen = 12;
            data.forEach(row => {
                const val = row[i] ? row[i].toString() : '';
                if (val.length > maxLen) maxLen = val.length;
            });
            return { wch: maxLen + 2 };
        });
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, `Bao_cao_tong_hop_nam_${year}.xlsx`);
    },

    exportJsonBackup() {
        const backupObj = {
            version: "5.0",
            backupDate: new Date().toISOString(),
            appData: AppData.state,
            settings: {
                exclude_docking_depreciation: localStorage.getItem('exclude_docking_depreciation') || 'false',
                theme: localStorage.getItem('theme') || 'dark'
            },
            monthlyReportInputs: {}
        };
        
        // Gather all monthly vessel report inputs (custom expenses, opening balances) from localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('monthly_vessel_report_inputs_')) {
                backupObj.monthlyReportInputs[key] = localStorage.getItem(key);
            }
        }
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        const dateStr = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute("download", `ShipManage_Backup_${dateStr}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    },

    importJsonBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backupObj = JSON.parse(e.target.result);
                if (!backupObj || !backupObj.appData) {
                    throw new Error("Tệp sao lưu không hợp lệ hoặc thiếu dữ liệu appData.");
                }
                
                if (confirm("Hành động này sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại trên máy của bạn.\nBạn có chắc chắn muốn khôi phục dữ liệu từ tệp này không?")) {
                    // Restore app state
                    AppData.state = backupObj.appData;
                    localStorage.setItem(DB_KEY, JSON.stringify(AppData.state));
                    
                    // Restore UI/UX settings
                    if (backupObj.settings) {
                        localStorage.setItem('exclude_docking_depreciation', backupObj.settings.exclude_docking_depreciation || 'false');
                        localStorage.setItem('theme', backupObj.settings.theme || 'dark');
                    }
                    
                    // Restore monthly custom inputs
                    if (backupObj.monthlyReportInputs) {
                        Object.keys(backupObj.monthlyReportInputs).forEach(key => {
                            localStorage.setItem(key, backupObj.monthlyReportInputs[key]);
                        });
                    }
                    
                    alert("✅ KHÔI PHỤC THÀNH CÔNG!\n\nHệ thống sẽ tải lại trang để áp dụng toàn bộ dữ liệu & cấu hình UI/UX mới.");
                    window.location.reload();
                }
            } catch (err) {
                console.error("Import JSON failed:", err);
                alert("❌ THẤT BẠI: Tệp JSON không hợp lệ hoặc bị hỏng!\n\nChi tiết: " + err.message);
            }
        };
        reader.readAsText(file);
    },

    init() {
        // Initialize Theme from localStorage & Bind Toggle Event
        const themeToggle = document.querySelector('.theme-toggle');
        const body = document.body;
        const currentTheme = localStorage.getItem('theme') || 'dark';
        
        if (currentTheme === 'light') {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
            if (themeToggle) themeToggle.innerHTML = '<i class="fa-regular fa-sun"></i>';
        } else {
            body.classList.remove('light-theme');
            body.classList.add('dark-theme');
            if (themeToggle) themeToggle.innerHTML = '<i class="fa-regular fa-moon"></i>';
        }

        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                if (body.classList.contains('dark-theme')) {
                    body.classList.remove('dark-theme');
                    body.classList.add('light-theme');
                    themeToggle.innerHTML = '<i class="fa-regular fa-sun"></i>';
                    localStorage.setItem('theme', 'light');
                } else {
                    body.classList.remove('light-theme');
                    body.classList.add('dark-theme');
                    themeToggle.innerHTML = '<i class="fa-regular fa-moon"></i>';
                    localStorage.setItem('theme', 'dark');
                }
            });
        }

        // Auto toggle print classes for inline reports printing
        window.addEventListener('beforeprint', () => {
            const isModalOpen = document.getElementById('report-modal')?.classList.contains('active');
            if (!isModalOpen) {
                document.body.classList.add('printing-inline-report');
            }
        });
        window.addEventListener('afterprint', () => {
            document.body.classList.remove('printing-inline-report');
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.getAttribute('data-view');
                if (view) this.navigate(view);
            });
        });

        // Mobile Sidebar Events Toggle
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        const closeBtn = document.getElementById('sidebar-close-btn');
        const overlay = document.getElementById('sidebar-overlay');
        const sidebar = document.querySelector('.sidebar');
        
        if (toggleBtn && sidebar && overlay) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.add('sidebar-open');
                overlay.classList.add('active');
            });
        }
        
        if (closeBtn && sidebar && overlay) {
            closeBtn.addEventListener('click', () => {
                sidebar.classList.remove('sidebar-open');
                overlay.classList.remove('active');
            });
        }
        
        if (overlay && sidebar) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('sidebar-open');
                overlay.classList.remove('active');
            });
        }

        this.setupCurrencyInputTooltip();
        this.navigate(this.currentView);
    },

    setupCurrencyInputTooltip() {
        let tooltip = document.getElementById('currency-preview-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'currency-preview-tooltip';
            tooltip.style.position = 'absolute';
            tooltip.style.zIndex = '999999';
            tooltip.style.background = 'rgba(15, 23, 42, 0.95)';
            tooltip.style.backdropFilter = 'blur(8px)';
            tooltip.style.border = '1px solid var(--primary-light, #3b82f6)';
            tooltip.style.color = '#ffffff';
            tooltip.style.padding = '6px 12px';
            tooltip.style.borderRadius = '8px';
            tooltip.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)';
            tooltip.style.fontSize = '0.9rem';
            tooltip.style.fontWeight = 'bold';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateY(10px) scale(0.95)';
            tooltip.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
            tooltip.style.display = 'none';
            document.body.appendChild(tooltip);
        }

        const formatVND = (num) => {
            return new Intl.NumberFormat('vi-VN').format(num) + ' VNĐ';
        };

        const formatVNDToWords = (n) => {
            if (isNaN(n) || n === 0) return '';
            if (n >= 1e9) {
                let val = (n / 1e9).toFixed(2).replace(/\.?0+$/, '');
                return `(${val} tỷ)`;
            }
            if (n >= 1e6) {
                let val = (n / 1e6).toFixed(2).replace(/\.?0+$/, '');
                return `(${val} triệu)`;
            }
            if (n >= 1e3) {
                let val = (n / 1e3).toFixed(2).replace(/\.?0+$/, '');
                return `(${val} nghìn)`;
            }
            return '';
        };

        const isCurrencyInput = (input) => {
            if (input.type !== 'number' && input.type !== 'text') return false;
            const checkString = (input.id + ' ' + (input.placeholder || '') + ' ' + (input.className || '') + ' ' + (input.getAttribute('name') || '')).toLowerCase();
            const keywords = ['thu', 'chi', 'price', 'amount', 'rate', 'salary', 'cost', 'interest', 'alloc', 'fund', 'money', 'markup', 'added', 'freight', 'refund', 'opening', 'vessel-alloc'];
            if (keywords.some(k => checkString.includes(k))) return true;
            
            const formGroup = input.closest('.form-group');
            if (formGroup) {
                const label = formGroup.querySelector('label');
                if (label) {
                    const labelText = label.textContent.toLowerCase();
                    const labelKeywords = ['thu', 'chi', 'tiền', 'giá', 'phí', 'lương', 'cước', 'nợ', 'thanh toán', 'vnd', 'vnđ'];
                    if (labelKeywords.some(k => labelText.includes(k))) return true;
                }
            }
            return false;
        };

        let activeInput = null;

        const updateTooltip = (input) => {
            const val = parseFloat(input.value);
            if (!isNaN(val) && val > 0) {
                activeInput = input;
                const formatted = formatVND(val);
                const words = formatVNDToWords(val);
                tooltip.innerHTML = `<i class="fa-solid fa-calculator" style="color: var(--accent, #3b82f6); margin-right: 6px;"></i>${formatted} <span style="color: #94a3b8; font-weight: normal; font-size: 0.85rem; margin-left: 4px;">${words}</span>`;
                
                const rect = input.getBoundingClientRect();
                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                
                tooltip.style.display = 'block';
                
                const tooltipHeight = tooltip.clientHeight;
                tooltip.style.left = (rect.left + scrollLeft + (rect.width - tooltip.clientWidth) / 2) + 'px';
                tooltip.style.top = (rect.top + scrollTop - tooltipHeight - 10) + 'px';
                
                setTimeout(() => {
                    tooltip.style.opacity = '1';
                    tooltip.style.transform = 'translateY(0) scale(1)';
                }, 10);
            } else {
                hideTooltip();
            }
        };

        const hideTooltip = () => {
            activeInput = null;
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateY(10px) scale(0.95)';
            setTimeout(() => {
                if (tooltip.style.opacity === '0') {
                    tooltip.style.display = 'none';
                }
            }, 150);
        };

        this.hideCurrencyTooltip = hideTooltip;

        if (document.body && typeof document.body.addEventListener === 'function') {
            document.body.addEventListener('focusin', (e) => {
                if (isCurrencyInput(e.target)) {
                    activeInput = e.target;
                    updateTooltip(e.target);
                }
            });

            document.body.addEventListener('input', (e) => {
                if (isCurrencyInput(e.target)) {
                    updateTooltip(e.target);
                }
            });

            document.body.addEventListener('focusout', (e) => {
                if (isCurrencyInput(e.target)) {
                    activeInput = null;
                    hideTooltip();
                }
            });
        }

        if (typeof document.addEventListener === 'function') {
            document.addEventListener('scroll', () => {
                if (activeInput) {
                    if (document.body.contains(activeInput)) {
                        updateTooltip(activeInput);
                    } else {
                        hideTooltip();
                    }
                }
            }, { capture: true, passive: true });
        }
    },

    changeFinancialsTab(tab) {
        this.currentFinancialsTab = tab;
        this.navigate('financials');
    },

    updateSummaryFilter() {
        const yearEl  = document.getElementById('summary-year');
        const fromEl  = document.getElementById('summary-month-from');
        const toEl    = document.getElementById('summary-month-to');
        const year      = yearEl ? yearEl.value : '';
        const monthFrom = fromEl ? fromEl.value : '1';
        const monthTo   = toEl  ? toEl.value   : '12';
        this.navigate('reports', 'summary', '', '', '', '', year, '', monthFrom, monthTo);
    },

    navigate(viewName, ...args) {
        // One-time migration to set all employees' joinDate to '2026-01-01'
        if (localStorage.getItem('employees_joindate_migration_2026_v2') !== 'true') {
            if (AppData.state && AppData.state.employees && AppData.state.employees.length > 0) {
                AppData.state.employees.forEach(emp => {
                    emp.joinDate = '2026-01-01';
                });
                AppData.save();
                localStorage.setItem('employees_joindate_migration_2026_v2', 'true');
                console.log('Successfully set all employees joinDate to 2026-01-01 via auto-migration');
            }
        }

        // One-time migration to set crew allowances: Phone 2.5M, Clothing 400k, Transport 2.5M
        if (localStorage.getItem('employees_crew_allowances_migration_2026') !== 'true') {
            if (AppData.state && AppData.state.employees && AppData.state.employees.length > 0) {
                AppData.state.employees.forEach(emp => {
                    if (emp.department !== 'VP') {
                        emp.phoneAllowance = 2500000;
                        emp.clothingAllowance = 400000;
                        emp.transportAllowance = 2500000;
                    }
                });
                AppData.save();
                localStorage.setItem('employees_crew_allowances_migration_2026', 'true');
                console.log('Successfully set all crew allowances via auto-migration');
            }
        }

        if (typeof this.hideCurrencyTooltip === 'function') {
            this.hideCurrencyTooltip();
        }
        this.updateHeaderCompanyInfo();
        if (!Views[viewName]) return;
        this.currentView = viewName;
        this.currentViewArgs = args;
        if (viewName === 'debts' && args.length > 0) {
            this.currentDebtTab = args[0];
        }
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-view') === viewName) item.classList.add('active');
        });
        const container = document.getElementById('view-container');
        try {
            if (viewName === 'hr') {
                container.innerHTML = Views.hr(this.hrTab || 'all');
            } else if (viewName === 'financials') {
                const m = args[0] !== undefined ? args[0] : (this.lastFinancialsMonth || '');
                const v = args[1] !== undefined ? args[1] : (this.lastFinancialsVessel || '');
                const c = args[2] !== undefined ? args[2] : (this.lastFinancialsCategory || '');
                const p = args[3] !== undefined ? args[3] : (this.lastFinancialsPartner || '');
                
                this.lastFinancialsMonth = m;
                this.lastFinancialsVessel = v;
                this.lastFinancialsCategory = c;
                this.lastFinancialsPartner = p;
                
                container.innerHTML = Views.financials(m, v, c, p);
            } else if (viewName === 'fuel') {
                const vId = args[0] !== undefined ? args[0] : (this.lastFuelVesselId || '');
                const vessels = AppData.getVessels();
                this.lastFuelVesselId = vId || (vessels[0] ? vessels[0].id : '');
                const activeTab = args[1] !== undefined ? args[1] : (this.lastFuelTab || 'DO');
                this.lastFuelTab = activeTab;
                
                container.innerHTML = Views.fuel(this.lastFuelVesselId, activeTab);
            } else if (viewName === 'shipments') {
                const m = args[0] !== undefined ? args[0] : (this.lastShipmentsMonth || '');
                const y = args[1] !== undefined ? args[1] : (this.lastShipmentsYear || '');
                const v = args[2] !== undefined ? args[2] : (this.lastShipmentsVessel || '');
                const c = args[3] !== undefined ? args[3] : (this.lastShipmentsCustomer || '');
                
                this.lastShipmentsMonth = m;
                this.lastShipmentsYear = y;
                this.lastShipmentsVessel = v;
                this.lastShipmentsCustomer = c;
                
                container.innerHTML = Views.shipments(m, y, v, c);
            } else {
                container.innerHTML = Views[viewName](...args);
            }
        } catch (err) {
            console.error('Error rendering view ' + viewName + ':', err);
            alert('LỖI HIỂN THỊ TRANG ' + viewName + ':\n' + err.message + '\nStack: ' + err.stack);
        }

        // Close sidebar on mobile navigation
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && sidebar.classList.contains('sidebar-open')) {
            sidebar.classList.remove('sidebar-open');
        }
        if (overlay && overlay.classList.contains('active')) {
            overlay.classList.remove('active');
        }

        // Post-render logic
        if (viewName === 'dashboard') {
            this.renderDashboardCharts(...args);
        }
        if (viewName === 'financials') {
            this.renderFinancialChart();
        }
        if (viewName === 'vessel-expenses') {
            this.loadVesselExpenses();
        }
        if (viewName === 'shipments') {
            this.initDoubleScroll('shipments-scroll-wrapper');
            this.updateSelectedComparisonCount();
        }
        if (viewName === 'debts') {
            this.initDoubleScroll('debts-voyages-scroll-wrapper');
        }
        if (viewName === 'reports' && args[0] === 'monthly') {
            // Set active vessel/month for inline monthly report persistence
            const vessels = AppData.getVessels();
            const fvm = args[3] || (vessels[0] ? vessels[0].id : '');
            const ships = AppData.getShipments();
            const monthsSet = new Set();
            ships.forEach(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (m) monthsSet.add(m);
            });
            const availableMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
            const fmm = args[4] || (availableMonths.length > 0 ? availableMonths[0] : '');
            this.activeReportVessel = fvm;
            this.activeReportMonth = fmm;
        }
    },

    initDoubleScroll(wrapperId) {
        setTimeout(() => {
            const wrapper = document.getElementById(wrapperId);
            if (!wrapper) return;
            
            const topScroll = wrapper.querySelector('.top-scrollbar');
            const tableContainer = wrapper.querySelector('.table-container');
            const dummy = wrapper.querySelector('.top-scrollbar-dummy');
            const table = wrapper.querySelector('.table');
            
            if (!topScroll || !tableContainer || !dummy || !table) return;
            
            const updateWidth = () => {
                const tableWidth = table.scrollWidth;
                const containerWidth = tableContainer.clientWidth;
                
                if (tableWidth > containerWidth) {
                    topScroll.style.display = 'block';
                    dummy.style.width = tableWidth + 'px';
                } else {
                    topScroll.style.display = 'none';
                }
            };
            
            updateWidth();
            
            if (window.ResizeObserver) {
                const observer = new ResizeObserver(() => updateWidth());
                observer.observe(table);
                observer.observe(tableContainer);
                wrapper._scrollbarObserver = observer;
            } else {
                window.onresize = updateWidth;
            }
            
            let activeScroll = null;
            
            topScroll.onscroll = () => {
                if (activeScroll !== tableContainer) {
                    activeScroll = topScroll;
                    tableContainer.scrollLeft = topScroll.scrollLeft;
                }
                activeScroll = null;
            };
            
            tableContainer.onscroll = () => {
                if (activeScroll !== topScroll) {
                    activeScroll = tableContainer;
                    topScroll.scrollLeft = tableContainer.scrollLeft;
                }
                activeScroll = null;
            };
        }, 150);
    },

    changeDebtCustomer(custName) {
        this.selectedDebtCustomer = custName;
        this.navigate('debts');
    },

    filterFinancials(month) {
        this.navigate('financials', month);
    },

    updateFinancialsFilters() {
        const month = document.getElementById('filter-fin-month').value;
        const vessel = document.getElementById('filter-fin-vessel').value;
        const category = document.getElementById('filter-fin-category').value;
        const partner = document.getElementById('filter-fin-partner').value;
        
        this.lastFinancialsMonth = month;
        this.lastFinancialsVessel = vessel;
        this.lastFinancialsCategory = category;
        this.lastFinancialsPartner = partner;
        
        this.navigate('financials', month, vessel, category, partner);
    },

    resetFinancialsFilters() {
        this.lastFinancialsMonth = '';
        this.lastFinancialsVessel = '';
        this.lastFinancialsCategory = '';
        this.lastFinancialsPartner = '';
        this.navigate('financials');
    },


    renderFinancialChart() {
        const ctx = document.getElementById('financialChart');
        if (!ctx) return;

        if (typeof Chart === 'undefined') {
            console.warn("Chart.js library is not loaded. Skipping rendering of financials chart.");
            if (ctx && ctx.parentNode) {
                const msgEl = document.createElement('div');
                msgEl.className = 'chart-error-placeholder';
                msgEl.style.cssText = 'display:flex; align-items:center; justify-content:center; height:200px; color:var(--text-muted); font-size:0.9rem; font-style:italic; border:1px dashed var(--border-color); border-radius:var(--radius-md); text-align: center;';
                msgEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px; color: var(--warning);"></i> Không thể hiển thị biểu đồ do chưa tải xong thư viện Biểu đồ';
                ctx.parentNode.replaceChild(msgEl, ctx);
            }
            return;
        }

        const trans = AppData.getTransactions().filter(t => t.category !== 'Luân chuyển');
        const monthly = {};
        trans.forEach(t => {
            const m = t.date.substring(0, 7);
            if (!monthly[m]) monthly[m] = { thu: 0, chi: 0 };
            monthly[m].thu += (Number(t.thu) || 0);
            monthly[m].chi += (Number(t.chi) || 0);
        });

        const labels = Object.keys(monthly).sort();
        const thuData = labels.map(l => monthly[l].thu);
        const chiData = labels.map(l => monthly[l].chi);
        const balanceData = labels.map(l => monthly[l].thu - monthly[l].chi);

        // Update top stats for current/latest month
        const latestMonth = labels[labels.length - 1];
        if (latestMonth) {
            document.getElementById('monthly-thu-val').innerText = AppData.formatCurrency(monthly[latestMonth].thu);
            document.getElementById('monthly-chi-val').innerText = AppData.formatCurrency(monthly[latestMonth].chi);
            document.getElementById('monthly-balance-val').innerText = AppData.formatCurrency(monthly[latestMonth].thu - monthly[latestMonth].chi);
        }

        if (this.finChart) this.finChart.destroy();

        this.finChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(l => `Tháng ${l.split('-').reverse().join('/')}`),
                datasets: [
                    {
                        label: 'Tổng Thu',
                        data: thuData,
                        backgroundColor: 'rgba(16, 185, 129, 0.6)',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Tổng Chi',
                        data: chiData,
                        backgroundColor: 'rgba(244, 63, 94, 0.6)',
                        borderColor: '#f43f5e',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Lợi nhuận',
                        data: balanceData,
                        type: 'line',
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: '#0ea5e9'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#94a3b8', font: { family: 'Inter' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += AppData.formatCurrency(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { 
                            color: '#94a3b8',
                            callback: value => (value / 1e6).toFixed(0) + 'M'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    },

    renderDashboardCharts(filterMonth = '') {
        const canvasVessel = document.getElementById('repVesselChart');
        const canvasTrend = document.getElementById('repTrendChart');
        const canvasCost = document.getElementById('repCostChart');
        const canvasFuel = document.getElementById('repFuelChart');

        if (!canvasVessel || !canvasTrend || !canvasCost || !canvasFuel) return;

        if (typeof Chart === 'undefined') {
            console.warn("Chart.js library is not loaded. Skipping rendering of dashboard charts.");
            [canvasVessel, canvasTrend, canvasCost, canvasFuel].forEach(canvas => {
                if (canvas && canvas.parentNode) {
                    const msgEl = document.createElement('div');
                    msgEl.className = 'chart-error-placeholder';
                    msgEl.style.cssText = 'display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-muted); font-size:0.9rem; font-style:italic; padding: 20px; text-align: center;';
                    msgEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px; color: var(--warning);"></i> Không thể tải thư viện Biểu đồ (Kiểm tra mạng)';
                    canvas.parentNode.replaceChild(msgEl, canvas);
                }
            });
            return;
        }

        const allShipments = AppData.getShipments();
        let shipments = allShipments;
        if (filterMonth) {
            shipments = allShipments.filter(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (!m) return false;
                
                if (filterMonth.length === 4) { // Year e.g. "2026"
                    return m.startsWith(filterMonth);
                } else if (filterMonth.includes('-Q')) { // Quarter e.g. "2026-Q1"
                    const [y, qStr] = filterMonth.split('-Q');
                    const q = Number(qStr);
                    const mm = Number(m.split('-')[1]);
                    const mq = Math.ceil(mm / 3);
                    return m.startsWith(y) && mq === q;
                } else { // Month e.g. "2026-05"
                    return m === filterMonth;
                }
            });
        }

        // 1. Dữ liệu theo Tàu (Vessel Stats)
        const vesselStats = {};
        AppData.state.vessels.forEach(v => {
            vesselStats[v.id] = { name: v.name, revenue: 0, cost: 0, profit: 0, fuelDO: 0 };
        });

        shipments.forEach(s => {
            const vId = s.vesselId;
            if (!vesselStats[vId]) {
                vesselStats[vId] = { name: vId, revenue: 0, cost: 0, profit: 0, fuelDO: 0 };
            }
            const rev = Number(s.revenueReal || 0);
            const financials = AppData.calculateShipmentFinancials(s);
            const costSum = financials.costSum + financials.vat;
            const profit = financials.profit;
            
            vesselStats[vId].revenue += rev;
            vesselStats[vId].cost += costSum;
            vesselStats[vId].profit += profit;
            vesselStats[vId].fuelDO += Number(s.costs?.fuelDO || 0);
        });

        const vesselLabels = Object.keys(vesselStats).sort();
        const vesselNames = vesselLabels.map(id => vesselStats[id].name);
        const vesselRevData = vesselLabels.map(id => vesselStats[id].revenue);
        const vesselCostData = vesselLabels.map(id => vesselStats[id].cost);
        const vesselProfitData = vesselLabels.map(id => vesselStats[id].profit);
        const vesselFuelData = vesselLabels.map(id => vesselStats[id].fuelDO);

        // Destroy existing charts to prevent memory leak/hover glitch
        if (this.dashboardCharts) {
            Object.values(this.dashboardCharts).forEach(c => {
                if (c && typeof c.destroy === 'function') c.destroy();
            });
        }
        this.dashboardCharts = {};

        // Vẽ biểu đồ 1: Hiệu quả theo Tàu
        this.dashboardCharts.vessel = new Chart(canvasVessel, {
            type: 'bar',
            data: {
                labels: vesselNames,
                datasets: [
                    {
                        label: 'Doanh thu',
                        data: vesselRevData,
                        backgroundColor: 'rgba(14, 165, 233, 0.75)',
                        borderColor: '#0ea5e9',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Chi phí',
                        data: vesselCostData,
                        backgroundColor: 'rgba(244, 63, 94, 0.75)',
                        borderColor: '#f43f5e',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Lợi nhuận ròng',
                        data: vesselProfitData,
                        backgroundColor: 'rgba(16, 185, 129, 0.75)',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + AppData.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: value => (value / 1e6).toFixed(0) + 'M' }
                    },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });

        // 2. Dữ liệu theo Tháng hoặc Chuyến (Monthly Trend / Voyage Details)
        let trendLabels = [];
        let trendRevData = [];
        let trendProfitData = [];

        if (!filterMonth) {
            // Hiển thị xu hướng theo Tháng
            const monthlyStats = {};
            shipments.forEach(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (!m) return;
                if (!monthlyStats[m]) {
                    monthlyStats[m] = { revenue: 0, cost: 0, profit: 0 };
                }
                const rev = Number(s.revenueReal || 0);
                const financials = AppData.calculateShipmentFinancials(s);
                const costSum = financials.costSum + financials.vat;
                const profit = financials.profit;

                monthlyStats[m].revenue += rev;
                monthlyStats[m].cost += costSum;
                monthlyStats[m].profit += profit;
            });

            const monthLabels = Object.keys(monthlyStats).sort();
            trendLabels = monthLabels.map(m => `Tháng ${m.split('-')[1]}/${m.split('-')[0]}`);
            trendRevData = monthLabels.map(m => monthlyStats[m].revenue);
            trendProfitData = monthLabels.map(m => monthlyStats[m].profit);
        } else {
            // Lọc theo tháng: hiển thị chi tiết theo từng chuyến đi
            const sortedVoyages = [...shipments].sort((a, b) => {
                const numA = parseInt((a.contractNo || '').replace(/\D/g, '')) || 0;
                const numB = parseInt((b.contractNo || '').replace(/\D/g, '')) || 0;
                return numA - numB; // Thứ tự hợp đồng tăng dần
            });
            trendLabels = sortedVoyages.map(s => `${s.vesselId} (HĐ: ${s.contractNo || s.voyageNo})`);
            trendRevData = sortedVoyages.map(s => Number(s.revenueReal || 0));
            trendProfitData = sortedVoyages.map(s => {
                const financials = AppData.calculateShipmentFinancials(s);
                return financials.profit;
            });
        }

        // Vẽ biểu đồ 2: Xu hướng
        this.dashboardCharts.trend = new Chart(canvasTrend, {
            type: filterMonth ? 'bar' : 'line',
            data: {
                labels: trendLabels,
                datasets: [
                    {
                        label: 'Doanh thu thực tế',
                        data: trendRevData,
                        borderColor: '#38bdf8',
                        backgroundColor: filterMonth ? 'rgba(56, 189, 248, 0.75)' : 'rgba(56, 189, 248, 0.1)',
                        fill: !filterMonth,
                        tension: 0.35,
                        borderWidth: filterMonth ? 1 : 3,
                        borderRadius: filterMonth ? 4 : 0,
                        pointBackgroundColor: '#38bdf8'
                    },
                    {
                        label: 'Lợi nhuận ròng',
                        data: trendProfitData,
                        borderColor: '#34d399',
                        backgroundColor: filterMonth ? 'rgba(52, 211, 153, 0.75)' : 'rgba(52, 211, 153, 0.1)',
                        fill: !filterMonth,
                        tension: 0.35,
                        borderWidth: filterMonth ? 1 : 3,
                        borderRadius: filterMonth ? 4 : 0,
                        pointBackgroundColor: '#34d399'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + AppData.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: value => (value / 1e6).toFixed(0) + 'M' }
                    },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });

        // 3. Cơ cấu Chi phí (Cost Structure)
        const costSums = {
            fuelDO: 0,
            fuelLO: 0,
            crewSalary: 0,
            crewFood: 0,
            crewInsurance: 0,
            materialCompany: 0,
            materialVessel: 0,
            monthlyOther: 0,
            agent: 0,
            vessel2ends: 0,
            portFees: 0,
            brokerage: 0,
            vat: 0,
            others: 0,
            dockingIntermediate: 0,
            dockingPeriodic: 0,
            registryAnnual: 0,
            depreciation: 0,
            hullInsurance: 0,
            largeRepair: 0
        };

        shipments.forEach(s => {
            const financials = AppData.calculateShipmentFinancials(s);
            const vat = financials.vat;
            costSums.fuelDO += Number(s.costs?.fuelDO || 0);
            costSums.fuelLO += Number(s.costs?.fuelLO || 0);
            costSums.crewSalary += Number(s.costs?.crewSalary || 0);
            costSums.crewFood += Number(s.costs?.crewFood || 0);
            costSums.crewInsurance += Number(s.costs?.crewInsurance || 0);
            costSums.materialCompany += Number(s.costs?.materialCompany || 0);
            costSums.materialVessel += Number(s.costs?.materialVessel || 0);
            costSums.monthlyOther += Number(s.costs?.monthlyOther || 0);
            costSums.agent += Number(s.costs?.agent || 0);
            costSums.vessel2ends += Number(s.costs?.vessel2ends || 0);
            costSums.portFees += Number(s.costs?.portFees || 0);
            costSums.brokerage += Number(s.costs?.brokerage || 0);
            costSums.vat += vat;
            costSums.others += Number(s.costs?.others || 0);
            costSums.dockingIntermediate += this.excludeDockingDepreciation ? 0 : Number(s.costs?.dockingIntermediate || 0);
            costSums.dockingPeriodic += this.excludeDockingDepreciation ? 0 : Number(s.costs?.dockingPeriodic || 0);
            costSums.registryAnnual += Number(s.costs?.registryAnnual || 0);
            costSums.depreciation += this.excludeDockingDepreciation ? 0 : Number(s.costs?.depreciation || 0);
            costSums.hullInsurance += Number(s.costs?.hullInsurance || 0);
            costSums.largeRepair += Number(s.costs?.largeRepair || 0);
        });

        const costLabels = [
            'Dầu DO',
            'Dầu LO',
            'Lương thuyền viên',
            'Tiền ăn',
            'Bảo hiểm TV',
            'Vật tư Cty cấp',
            'Vật tư Tàu chi',
            'CP Phân bổ Cty',
            'Đại lý 2 đầu cảng',
            'Tàu chi 2 đầu cảng',
            'Phí cảng & hoa tiêu',
            'Tiền Bông',
            'Thuế VAT',
            'Chi phí khác',
            'Lên đà trung gian',
            'Lên đà định kỳ',
            'Đăng kiểm hàng năm',
            'Khấu hao tài sản',
            'Bảo hiểm thân vỏ',
            'Sửa chữa lớn'
        ];

        const costValues = [
            costSums.fuelDO,
            costSums.fuelLO,
            costSums.crewSalary,
            costSums.crewFood,
            costSums.crewInsurance,
            costSums.materialCompany,
            costSums.materialVessel,
            costSums.monthlyOther,
            costSums.agent,
            costSums.vessel2ends,
            costSums.portFees,
            costSums.brokerage,
            costSums.vat,
            costSums.others,
            costSums.dockingIntermediate,
            costSums.dockingPeriodic,
            costSums.registryAnnual,
            costSums.depreciation,
            costSums.hullInsurance,
            costSums.largeRepair
        ];

        const costColors = [
            'rgba(245, 158, 11, 0.8)',
            'rgba(217, 119, 6, 0.8)',
            'rgba(79, 70, 229, 0.8)',
            'rgba(99, 102, 241, 0.8)',
            'rgba(129, 140, 248, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(52, 211, 153, 0.8)',
            'rgba(110, 231, 183, 0.8)',
            'rgba(14, 165, 233, 0.8)',
            'rgba(56, 189, 248, 0.8)',
            'rgba(186, 230, 253, 0.8)',
            'rgba(244, 63, 94, 0.8)',
            'rgba(225, 29, 72, 0.8)',
            'rgba(156, 163, 175, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(234, 179, 8, 0.8)',
            'rgba(20, 184, 166, 0.8)',
            'rgba(99, 102, 241, 0.8)',
            'rgba(147, 51, 234, 0.8)'
        ];

        const filteredCosts = [];
        costLabels.forEach((lbl, idx) => {
            if (costValues[idx] > 0) {
                filteredCosts.push({
                    label: lbl,
                    value: costValues[idx],
                    color: costColors[idx]
                });
            }
        });

        // Vẽ biểu đồ 3: Cơ cấu chi phí
        this.dashboardCharts.cost = new Chart(canvasCost, {
            type: 'doughnut',
            data: {
                labels: filteredCosts.map(item => item.label),
                datasets: [{
                    data: filteredCosts.map(item => item.value),
                    backgroundColor: filteredCosts.map(item => item.color),
                    borderWidth: 1,
                    borderColor: 'rgba(15, 17, 26, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Inter', size: 10 },
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const val = context.parsed;
                                const pct = ((val / total) * 100).toFixed(1);
                                return context.label + ': ' + AppData.formatCurrency(val) + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });

        // Vẽ biểu đồ 4: Tiêu hao nhiên liệu DO
        this.dashboardCharts.fuel = new Chart(canvasFuel, {
            type: 'bar',
            data: {
                labels: vesselNames,
                datasets: [{
                    label: 'Tiền dầu DO',
                    data: vesselFuelData,
                    backgroundColor: 'rgba(245, 158, 11, 0.75)',
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Tiền dầu: ' + AppData.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: value => (value / 1e6).toFixed(0) + 'M' }
                    },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });

        // Tự động phân tích và nhận xét
        this.generateDashboardAnalysis(shipments, allShipments, filterMonth);
    },

    generateDashboardAnalysis(filteredShipments, allShipments, filterMonth) {
        const el = document.getElementById('reports-analysis-content');
        if (!el) return;

        if (filteredShipments.length === 0) {
            el.innerHTML = `<p style="color: var(--text-muted);"><i class="fa-solid fa-triangle-exclamation" style="color: var(--warning); margin-right: 6px;"></i>Không có dữ liệu chuyến hàng nào để phân tích trong giai đoạn này.</p>`;
            return;
        }

        // 1. Tính các chỉ số cơ bản
        let totalRevenue = 0;
        let totalCost = 0;
        let totalFuelDO = 0;
        let totalVat = 0;
        let totalBrokerage = 0;
        let totalCrewSalary = 0;

        filteredShipments.forEach(s => {
            totalRevenue += Number(s.revenueReal || 0);
            const financials = AppData.calculateShipmentFinancials(s);
            const costSum = financials.costSum + financials.vat;
            
            totalCost += costSum;
            totalFuelDO += Number(s.costs?.fuelDO || 0);
            totalVat += financials.vat;
            totalBrokerage += Number(s.costs?.brokerage || 0);
            totalCrewSalary += Number(s.costs?.crewSalary || 0);
        });

        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

        // 2. Tính hiệu suất theo Tàu
        const vesselStats = {};
        filteredShipments.forEach(s => {
            const vId = s.vesselId;
            if (!vesselStats[vId]) {
                vesselStats[vId] = { 
                    revenue: 0, 
                    cost: 0, 
                    profit: 0, 
                    voyages: 0,
                    costsDetail: {
                        fuelDO: 0,
                        fuelLO: 0,
                        crewSalary: 0,
                        crewFood: 0,
                        crewInsurance: 0,
                        materialCompany: 0,
                        materialVessel: 0,
                        monthlyOther: 0,
                        agent: 0,
                        vessel2ends: 0,
                        portFees: 0,
                        brokerage: 0,
                        vat: 0,
                        others: 0,
                        dockingIntermediate: 0,
                        dockingPeriodic: 0,
                        registryAnnual: 0,
                        depreciation: 0,
                        hullInsurance: 0,
                        largeRepair: 0
                    }
                };
            }
            const rev = Number(s.revenueReal || 0);
            const financials = AppData.calculateShipmentFinancials(s);
            const costSum = financials.costSum + financials.vat;
            const profit = financials.profit;
            
            vesselStats[vId].revenue += rev;
            vesselStats[vId].cost += costSum;
            vesselStats[vId].profit += profit;
            vesselStats[vId].voyages += 1;

            // Cộng dồn chi tiết từng hạng mục chi phí
            vesselStats[vId].costsDetail.fuelDO += Number(s.costs?.fuelDO || 0);
            vesselStats[vId].costsDetail.fuelLO += Number(s.costs?.fuelLO || 0);
            vesselStats[vId].costsDetail.crewSalary += Number(s.costs?.crewSalary || 0);
            vesselStats[vId].costsDetail.crewFood += Number(s.costs?.crewFood || 0);
            vesselStats[vId].costsDetail.crewInsurance += Number(s.costs?.crewInsurance || 0);
            vesselStats[vId].costsDetail.materialCompany += Number(s.costs?.materialCompany || 0);
            vesselStats[vId].costsDetail.materialVessel += Number(s.costs?.materialVessel || 0);
            vesselStats[vId].costsDetail.monthlyOther += Number(s.costs?.monthlyOther || 0);
            vesselStats[vId].costsDetail.agent += Number(s.costs?.agent || 0);
            vesselStats[vId].costsDetail.vessel2ends += Number(s.costs?.vessel2ends || 0);
            vesselStats[vId].costsDetail.portFees += Number(s.costs?.portFees || 0);
            vesselStats[vId].costsDetail.brokerage += Number(s.costs?.brokerage || 0);
            vesselStats[vId].costsDetail.vat += financials.vat;
            vesselStats[vId].costsDetail.others += Number(s.costs?.others || 0);
            vesselStats[vId].costsDetail.dockingIntermediate += this.excludeDockingDepreciation ? 0 : Number(s.costs?.dockingIntermediate || 0);
            vesselStats[vId].costsDetail.dockingPeriodic += this.excludeDockingDepreciation ? 0 : Number(s.costs?.dockingPeriodic || 0);
            vesselStats[vId].costsDetail.registryAnnual += Number(s.costs?.registryAnnual || 0);
            vesselStats[vId].costsDetail.depreciation += this.excludeDockingDepreciation ? 0 : Number(s.costs?.depreciation || 0);
            vesselStats[vId].costsDetail.hullInsurance += Number(s.costs?.hullInsurance || 0);
            vesselStats[vId].costsDetail.largeRepair += Number(s.costs?.largeRepair || 0);
        });

        let bestVessel = '', maxProfit = -Infinity;
        let worstVessel = '', minProfit = Infinity;
        let mostActiveVessel = '', maxVoyages = 0;

        Object.keys(vesselStats).forEach(vId => {
            const stats = vesselStats[vId];
            if (stats.profit > maxProfit) {
                maxProfit = stats.profit;
                bestVessel = vId;
            }
            if (stats.profit < minProfit) {
                minProfit = stats.profit;
                worstVessel = vId;
            }
            if (stats.voyages > maxVoyages) {
                maxVoyages = stats.voyages;
                mostActiveVessel = vId;
            }
        });

        const bestVesselObj = AppData.state.vessels.find(v => v.id === bestVessel) || { name: bestVessel };
        const worstVesselObj = AppData.state.vessels.find(v => v.id === worstVessel) || { name: worstVessel };

        // 3. Phân tích Chi phí
        const fuelDOPercent = totalRevenue > 0 ? ((totalFuelDO / totalRevenue) * 100).toFixed(1) : 0;
        const crewSalaryPercent = totalRevenue > 0 ? ((totalCrewSalary / totalRevenue) * 100).toFixed(1) : 0;

        // 4. Tính toán so sánh tăng trưởng nếu có chọn kỳ hạch toán
        let growthHTML = '';
        if (filterMonth) {
            let prevPeriodStr = '';
            let prevPeriodLabel = '';
            let isQuarter = filterMonth.includes('-Q');
            let isYear = filterMonth.length === 4;
            let isMonth = filterMonth.length === 7;

            if (isMonth) {
                const parts = filterMonth.split('-');
                let yr = parseInt(parts[0]);
                let mo = parseInt(parts[1]);
                mo--;
                if (mo === 0) {
                    mo = 12;
                    yr--;
                }
                prevPeriodStr = yr + '-' + String(mo).padStart(2, '0');
                prevPeriodLabel = `tháng trước (Tháng ${mo}/${yr})`;
            } else if (isYear) {
                let yr = parseInt(filterMonth);
                prevPeriodStr = String(yr - 1);
                prevPeriodLabel = `năm trước (Năm ${yr - 1})`;
            } else if (isQuarter) {
                const [yStr, qStr] = filterMonth.split('-Q');
                let yr = parseInt(yStr);
                let q = parseInt(qStr);
                q--;
                if (q === 0) {
                    q = 4;
                    yr--;
                }
                prevPeriodStr = `${yr}-Q${q}`;
                prevPeriodLabel = `quý trước (Quý ${q}/${yr})`;
            }

            const prevShipments = allShipments.filter(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (!m) return false;
                if (isMonth) {
                    return m === prevPeriodStr;
                } else if (isYear) {
                    return m.startsWith(prevPeriodStr);
                } else if (isQuarter) {
                    const [y, qValStr] = prevPeriodStr.split('-Q');
                    const qVal = Number(qValStr);
                    const mm = Number(m.split('-')[1]);
                    const mq = Math.ceil(mm / 3);
                    return m.startsWith(y) && mq === qVal;
                }
                return false;
            });

            if (prevShipments.length > 0) {
                let prevRevenue = 0;
                let prevCost = 0;
                prevShipments.forEach(s => {
                    prevRevenue += Number(s.revenueReal || 0);
                    const financials = AppData.calculateShipmentFinancials(s);
                    const costSum = financials.costSum + financials.vat;
                    prevCost += costSum;
                });
                const prevProfit = prevRevenue - prevCost;
                const profitDiff = totalProfit - prevProfit;
                
                let growthRate = 0;
                if (prevProfit !== 0) {
                    growthRate = ((profitDiff / Math.abs(prevProfit)) * 100).toFixed(1);
                }
                
                if (profitDiff > 0) {
                    growthHTML = `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-arrow-trend-up" style="color: var(--secondary); margin-right: 8px;"></i>So với ${prevPeriodLabel}, lợi nhuận ròng của công ty <strong>tăng trưởng ${growthRate}%</strong> (Tương đương tăng thêm <strong style="color: var(--secondary);">${AppData.formatCurrency(profitDiff)}</strong>).</li>`;
                } else if (profitDiff < 0) {
                    growthHTML = `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-arrow-trend-down" style="color: var(--accent); margin-right: 8px;"></i>So với ${prevPeriodLabel}, lợi nhuận ròng của công ty <strong>suy giảm ${Math.abs(growthRate)}%</strong> (Tương đương giảm <strong style="color: var(--accent);">${AppData.formatCurrency(Math.abs(profitDiff))}</strong>). Ban điều hành cần rà soát lại chi phí chuyến.</li>`;
                } else {
                    growthHTML = `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-equals" style="color: var(--info); margin-right: 8px;"></i>Lợi nhuận ròng duy trì ổn định tương đương ${prevPeriodLabel}.</li>`;
                }
            } else {
                growthHTML = `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-info" style="color: var(--info); margin-right: 8px;"></i>Không có dữ liệu của ${prevPeriodLabel.replace('so với ', '')} để so sánh tăng trưởng.</li>`;
            }
        }

        // 5. Cảnh báo và khuyến nghị (Operational Warnings & Recommendations)
        let alertHTML = '';
        let recommendationHTML = '';
        
        // Nhiên liệu DO
        if (Number(fuelDOPercent) > 40) {
            alertHTML += `<div style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 8px; padding: 12px; margin-top: 10px; display: flex; gap: 10px; align-items: flex-start;">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                    <strong style="color: var(--text-main); font-size: 0.9rem;">CẢNH BÁO CHI PHÍ NHIÊN LIỆU DO CAO:</strong>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                        Chi phí dầu DO chiếm tới <strong>${fuelDOPercent}%</strong> tổng doanh thu trong kỳ (vượt ngưỡng kiểm soát 40%). Ban quản lý cần rà soát lại định mức tiêu hao dầu của từng tàu.
                    </p>
                </div>
            </div>`;
            recommendationHTML += `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--primary-light); margin-right: 8px;"></i>Tăng cường giám sát chỉ số tiêu thụ nhiên liệu chặng và kiểm tra chênh lệch hiệu suất kỹ thuật giữa các tàu.</li>`;
        } else {
            recommendationHTML += `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--secondary); margin-right: 8px;"></i>Chi phí nhiên liệu DO chiếm <strong>${fuelDOPercent}%</strong> tổng doanh thu, nằm trong biên độ an toàn và kiểm soát tốt.</li>`;
        }

        // Lợi nhuận
        if (totalProfit < 0) {
            alertHTML += `<div style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 8px; padding: 12px; margin-top: 10px; display: flex; gap: 10px; align-items: flex-start;">
                <i class="fa-solid fa-chart-line-down" style="color: var(--accent); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                    <strong style="color: var(--text-main); font-size: 0.9rem;">CẢNH BÁO THUA LỖ:</strong>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                        Kỳ báo cáo này ghi nhận mức <strong>lỗ ròng</strong> <strong style="color: var(--accent);">${AppData.formatCurrency(Math.abs(totalProfit))}</strong>. Cần tối ưu ngay các khoản chi phí không thiết yếu.
                    </p>
                </div>
            </div>`;
            recommendationHTML += `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--primary-light); margin-right: 8px;"></i>Kiểm tra lại giá cước vận tải chuyến và đàm phán tối ưu phụ phí đại lý hoa tiêu cảng 2 đầu.</li>`;
        } else if (Number(profitMargin) < 15) {
            recommendationHTML += `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--warning); margin-right: 8px;"></i>Biên lợi nhuận ròng hiện ở mức thấp (<strong>${profitMargin}%</strong>). Công ty cần nâng cao hiệu suất xếp dỡ để rút ngắn số ngày chuyến tàu.</li>`;
        } else {
            recommendationHTML += `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--secondary); margin-right: 8px;"></i>Biên lợi nhuận ròng đạt hiệu quả lý tưởng (<strong>${profitMargin}%</strong>). Mô hình hoạt động hiện tại rất tối ưu.</li>`;
        }

        // Tàu kém hiệu quả
        if (minProfit < 0) {
            alertHTML += `<div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 12px; margin-top: 10px; display: flex; gap: 10px; align-items: flex-start;">
                <i class="fa-solid fa-circle-exclamation" style="color: var(--warning); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                    <strong style="color: var(--text-main); font-size: 0.9rem;">CẢNH BÁO TÀU HOẠT ĐỘNG THUA LỖ:</strong>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                        Tàu <strong>${worstVesselObj.name}</strong> đang có biên lợi nhuận âm <strong style="color: var(--accent);">${AppData.formatCurrency(minProfit)}</strong> qua <strong>${vesselStats[worstVessel].voyages}</strong> chuyến hàng.
                    </p>
                </div>
            </div>`;
        }

        let timeStr = 'Toàn bộ thời gian';
        if (filterMonth) {
            if (filterMonth.length === 4) {
                timeStr = `Năm ${filterMonth}`;
            } else if (filterMonth.includes('-Q')) {
                const [y, q] = filterMonth.split('-Q');
                timeStr = `Quý ${q}/${y}`;
            } else {
                const [y, m] = filterMonth.split('-');
                timeStr = `Tháng ${m}/${y}`;
            }
        }

        el.innerHTML = `
            <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 2rem;">
                <div>
                    <h4 style="margin: 0 0 0.75rem 0; color: var(--primary-light); font-size: 1.05rem;"><i class="fa-solid fa-list-check" style="margin-right: 6px;"></i>Nhận định Tài chính & Vận hành (${timeStr})</h4>
                    <ul style="padding-left: 1.25rem; margin: 0; color: var(--text-main);">
                        <li style="margin-bottom: 0.5rem;">
                            Tổng doanh thu thực tế toàn đội tàu đạt <strong style="color: var(--info);">${AppData.formatCurrency(totalRevenue)}</strong> 
                            với tổng chi phí vận hành chuyến là <strong style="color: var(--accent);">${AppData.formatCurrency(totalCost)}</strong>.
                        </li>
                        <li style="margin-bottom: 0.5rem;">
                            Lợi nhuận ròng thu về đạt <strong style="color: var(--secondary);">${AppData.formatCurrency(totalProfit)}</strong>, 
                            biên lợi nhuận ròng trung bình đạt <strong>${profitMargin}%</strong>.
                        </li>
                        ${growthHTML}
                        <li style="margin-bottom: 0.5rem;">
                            Tàu mang lại hiệu quả kinh tế cao nhất là <strong>${bestVesselObj.name}</strong> 
                            đạt lợi nhuận ròng <strong style="color: var(--secondary);">${AppData.formatCurrency(maxProfit)}</strong> 
                            qua <strong>${vesselStats[bestVessel].voyages}</strong> chuyến đi.
                        </li>
                        ${bestVessel !== worstVessel ? `
                        <li style="margin-bottom: 0.5rem;">
                            Tàu có hiệu quả kinh tế thấp nhất là <strong>${worstVesselObj.name}</strong> 
                            với lợi nhuận ròng là <strong style="${minProfit < 0 ? 'color: var(--accent);' : 'color: var(--text-main);'}">${AppData.formatCurrency(minProfit)}</strong>.
                        </li>
                        ` : ''}
                        <li style="margin-bottom: 0.5rem;">
                            Chi phí nhiên liệu DO là chi phí lớn nhất, tiêu tốn <strong style="color: var(--warning);">${AppData.formatCurrency(totalFuelDO)}</strong>, 
                            chiếm <strong>${fuelDOPercent}%</strong> tổng doanh thu thực tế.
                        </li>
                    </ul>
                </div>
                
                <div style="border-left: 1px solid var(--border-color); padding-left: 2rem;">
                    <h4 style="margin: 0 0 0.75rem 0; color: var(--secondary); font-size: 1.05rem;"><i class="fa-solid fa-lightbulb" style="margin-right: 6px;"></i>Đề xuất Khuyến nghị Vận hành</h4>
                    <ul style="padding-left: 1.25rem; margin: 0; color: var(--text-main); font-size: 0.9rem;">
                        ${recommendationHTML}
                        <li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--primary-light); margin-right: 8px;"></i>Tập trung khai thác và phân bổ thêm tài nguyên cho đội tàu <strong>${bestVesselObj.name}</strong> để tối ưu hóa doanh số.</li>
                    </ul>
                </div>
            </div>
            
            ${alertHTML ? `
            <div style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: var(--accent); font-size: 1.05rem;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i>Cảnh báo Vận hành khẩn cấp</h4>
                <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
                    ${alertHTML}
                </div>
            </div>
            ` : ''}

            <!-- Phân tích Chi tiết Từng Tàu -->
            <div style="margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                <h4 style="margin: 0 0 1.25rem 0; color: var(--primary-light); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-ship"></i> Phân tích Hiệu quả & Chi tiết Chi phí từng Tàu (${timeStr})
                </h4>
                <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
                    ${Object.keys(vesselStats).map(vId => {
                        const stats = vesselStats[vId];
                        const vesselObj = AppData.state.vessels.find(v => v.id === vId) || { name: vId };
                        const margin = stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) : 0;
                        
                        // Chi tiết các hạng mục chi phí > 0
                        const costLabels = {
                                fuelDO: 'Dầu DO',
                                fuelLO: 'Dầu LO',
                                crewSalary: 'Lương thuyền viên',
                                crewFood: 'Tiền ăn',
                                crewInsurance: 'Bảo hiểm TV',
                                materialCompany: 'Vật tư Cty cấp',
                                materialVessel: 'Vật tư Tàu chi',
                                monthlyOther: 'CP Phân bổ Cty',
                                agent: 'Đại lý 2 đầu cảng',
                                vessel2ends: 'Tàu chi 2 đầu cảng',
                                portFees: 'Phí cảng & hoa tiêu',
                                brokerage: 'Tiền Bông',
                                vat: 'Thuế VAT',
                                others: 'Chi phí khác',
                                dockingIntermediate: 'Lên đà trung gian',
                                dockingPeriodic: 'Lên đà định kỳ',
                                registryAnnual: 'Đăng kiểm hàng năm',
                                depreciation: 'Khấu hao tài sản',
                                hullInsurance: 'Bảo hiểm thân vỏ',
                                largeRepair: 'Sửa chữa lớn'
                        };

                        const costRows = Object.keys(costLabels).map(key => {
                            const val = stats.costsDetail[key] || 0;
                            if (val <= 0) return '';
                            const pct = stats.cost > 0 ? ((val / stats.cost) * 100).toFixed(1) : 0;
                            const revPct = stats.revenue > 0 ? ((val / stats.revenue) * 100).toFixed(1) : 0;
                            return `
                                <tr>
                                    <td style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); color: var(--text-muted);">${costLabels[key]}</td>
                                    <td style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); text-align: right; font-weight: 500;">${AppData.formatCurrency(val)}</td>
                                    <td style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); text-align: right; color: var(--warning); font-size: 0.85rem;">${pct}%</td>
                                    <td style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); text-align: right; color: var(--info); font-size: 0.85rem;">${revPct}%</td>
                                </tr>
                            `;
                        }).join('');

                        // Nhận xét định tính cho tàu này
                        let vesselComment = '';
                        if (stats.profit > 0) {
                            if (Number(margin) >= 20) {
                                vesselComment = `<span style="color: var(--secondary); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Hoạt động rất hiệu quả.</span> Lợi nhuận ròng tốt (${margin}%) nhờ kiểm soát chi phí tối ưu.`;
                            } else {
                                vesselComment = `<span style="color: var(--warning); font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> Hiệu quả trung bình.</span> Biên lợi nhuận ròng đạt ${margin}%, cần rà soát lại các hạng mục chi phí chiếm tỷ trọng cao.`;
                            }
                        } else {
                            vesselComment = `<span style="color: var(--accent); font-weight: 600;"><i class="fa-solid fa-circle-xmark"></i> Hoạt động thua lỗ.</span> Tàu bị âm lợi nhuận <strong style="color: var(--accent);">${AppData.formatCurrency(Math.abs(stats.profit))}</strong> trong kỳ này.`;
                        }

                        const specificDO = stats.costsDetail.fuelDO;
                        const specFuelDOPercent = stats.revenue > 0 ? ((specificDO / stats.revenue) * 100).toFixed(1) : 0;
                        if (Number(specFuelDOPercent) > 40) {
                            vesselComment += ` <br><span style="color: var(--accent); font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> Cảnh báo:</span> Chi phí dầu DO rất cao, chiếm <strong>${specFuelDOPercent}%</strong> tổng doanh thu của tàu.`;
                        }

                        return `
                            <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 1.25rem;">
                                <!-- Vessel Summary Header -->
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 1.1rem; font-weight: 700; color: var(--info);"><i class="fa-solid fa-ship"></i> ${vesselObj.name}</span>
                                        <span class="badge badge-outline" style="font-size: 0.75rem;">${stats.voyages} chuyến</span>
                                    </div>
                                    <div style="display: flex; gap: 1.5rem; font-size: 0.9rem;">
                                        <div>Doanh thu: <strong style="color: var(--info);">${AppData.formatCurrency(stats.revenue)}</strong></div>
                                        <div>Chi phí: <strong style="color: var(--accent);">${AppData.formatCurrency(stats.cost)}</strong></div>
                                        <div>Lợi nhuận: <strong class="${stats.profit >= 0 ? 'value-positive' : 'value-negative'}">${AppData.formatCurrency(stats.profit)} (${margin}%)</strong></div>
                                    </div>
                                </div>

                                <!-- Detail Layout: Comment and Cost Breakdown -->
                                <div style="display: grid; grid-template-columns: 1.2fr 2fr; gap: 2rem;">
                                    <div style="font-size: 0.9rem; line-height: 1.6; display: flex; flex-direction: column; justify-content: center; background: rgba(255,255,255,0.01); padding: 12px; border-radius: 6px; border-left: 3px solid var(--primary-light);">
                                        <h5 style="margin: 0 0 6px 0; font-size: 0.95rem; color: var(--text-main); font-weight: 600;">Nhận định vận hành:</h5>
                                        <p style="margin: 0; color: var(--text-muted);">${vesselComment}</p>
                                    </div>
                                    <div>
                                        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                                            <thead>
                                                <tr style="background: rgba(255,255,255,0.03); color: var(--text-muted); font-weight: 600;">
                                                    <th style="padding: 6px 12px; text-align: left;">Hạng mục chi phí</th>
                                                    <th style="padding: 6px 12px; text-align: right;">Số tiền</th>
                                                    <th style="padding: 6px 12px; text-align: right;">% Chi phí</th>
                                                    <th style="padding: 6px 12px; text-align: right;">% Doanh thu</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${costRows}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    openModal(id) { document.getElementById(id).classList.add('active'); },
    closeModal(id) {
        document.getElementById(id).classList.remove('active');
        if (typeof this.hideCurrencyTooltip === 'function') {
            this.hideCurrencyTooltip();
        }
        if (id === 'report-modal') {
            const m = document.querySelector('#report-modal .modal');
            if (m) {
                m.style.maxWidth = '';
                m.style.width = '';
            }
        }
    },

    hrTab: 'all',

    openEmployeeModal() {
        document.getElementById('employee-modal-content').innerHTML = Views.employeeModal();
        this.openModal('employee-modal');
    },
    editEmployee(id) {
        const e = AppData.getEmployee(id);
        if (!e) return;
        document.getElementById('employee-modal-content').innerHTML = Views.employeeModal(e);
        this.openModal('employee-modal');
    },
    saveEmployee(id) {
        const existing = id ? AppData.getEmployee(id) : null;
        const emp = {
            id: id || null,
            name: document.getElementById('emp-name').value,
            phone: document.getElementById('emp-phone').value,
            role: document.getElementById('emp-role').value,
            department: document.getElementById('emp-department').value,
            joinDate: document.getElementById('emp-join').value,
            leaveDate: document.getElementById('emp-leave').value,
            basicSalary: Number(document.getElementById('emp-basic-salary').value) || 0,
            mealAllowance: Number(document.getElementById('emp-meal-allowance').value) || 0,
            phoneAllowance: Number(document.getElementById('emp-phone-allowance').value) || 0,
            clothingAllowance: Number(document.getElementById('emp-clothing-allowance').value) || 0,
            transportAllowance: Number(document.getElementById('emp-transport-allowance').value) || 0,
            personalDeduction: Number(document.getElementById('emp-personal-deduction').value) || 0,
            dependents: Number(document.getElementById('emp-dependents').value) || 0,
            actualSalary: Number(document.getElementById('emp-actual-salary').value) || 0,
            insurance: document.getElementById('emp-insurance').value !== '' ? Number(document.getElementById('emp-insurance').value) : null,
            deliveryAllowance: Number(document.getElementById('emp-delivery-allowance').value) || 0,
            completionBonus: Number(document.getElementById('emp-completion-bonus').value) || 0,
            notes: document.getElementById('emp-notes').value,
            history: (existing && existing.history) ? [...existing.history] : []
        };

        const changeDate = document.getElementById('emp-change-date')?.value;
        if (changeDate && existing) {
            // Kiểm tra xem có thay đổi trường thông tin nào nhạy cảm lịch sử không
            const fieldsToCompare = [
                'department', 'basicSalary', 'actualSalary', 'mealAllowance', 
                'phoneAllowance', 'clothingAllowance', 'transportAllowance', 
                'personalDeduction', 'dependents', 'deliveryAllowance', 
                'completionBonus', 'insurance', 'role'
            ];
            
            let hasChanges = false;
            for (const field of fieldsToCompare) {
                if (emp[field] !== existing[field]) {
                    hasChanges = true;
                    break;
                }
            }
            
            if (hasChanges) {
                // Khởi tạo lịch sử cũ nếu mảng rỗng
                if (emp.history.length === 0) {
                    emp.history.push({
                        date: existing.joinDate || '1970-01-01',
                        department: existing.department,
                        basicSalary: existing.basicSalary,
                        actualSalary: existing.actualSalary,
                        mealAllowance: existing.mealAllowance,
                        phoneAllowance: existing.phoneAllowance,
                        clothingAllowance: existing.clothingAllowance,
                        transportAllowance: existing.transportAllowance,
                        personalDeduction: existing.personalDeduction,
                        dependents: existing.dependents,
                        deliveryAllowance: existing.deliveryAllowance,
                        completionBonus: existing.completionBonus,
                        insurance: existing.insurance,
                        role: existing.role
                    });
                }
                
                // Thêm hoặc cập nhật bản ghi lịch sử vào mảng
                const newHistoryEntry = {
                    date: changeDate,
                    department: emp.department,
                    basicSalary: emp.basicSalary,
                    actualSalary: emp.actualSalary,
                    mealAllowance: emp.mealAllowance,
                    phoneAllowance: emp.phoneAllowance,
                    clothingAllowance: emp.clothingAllowance,
                    transportAllowance: emp.transportAllowance,
                    personalDeduction: emp.personalDeduction,
                    dependents: emp.dependents,
                    deliveryAllowance: emp.deliveryAllowance,
                    completionBonus: emp.completionBonus,
                    insurance: emp.insurance,
                    role: emp.role
                };
                
                const existingIndex = emp.history.findIndex(h => h.date === changeDate);
                if (existingIndex !== -1) {
                    emp.history[existingIndex] = newHistoryEntry;
                } else {
                    emp.history.push(newHistoryEntry);
                }
                
                // Sắp xếp lại lịch sử theo ngày tăng dần
                emp.history.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
        }

        AppData.saveEmployee(emp);
        this.closeModal('employee-modal');
        if (this.currentView === 'salary') {
            const month = document.getElementById('sal-month')?.value || this.currentViewArgs[0];
            const dep = document.getElementById('sal-department')?.value || this.currentViewArgs[1];
            const tab = app.salaryTab || this.currentViewArgs[2] || 'thucte';
            this.navigate('salary', month, dep, tab);
        } else if (this.currentView === 'hr') {
            // Giữ nguyên tab tàu/bộ phận của nhân viên vừa lưu
            this.hrTab = emp.department || this.hrTab || 'all';
            this.navigate('hr');
        } else {
            this.navigate(this.currentView, ...this.currentViewArgs || []);
        }
    },
    deleteEmployee(id) {
        if (confirm('Bạn có chắc muốn xóa nhân sự này?')) {
            AppData.deleteEmployee(id);
            this.navigate('hr');
        }
    },
    openSettlementModal(employeeId) {
        const month = document.getElementById('sal-month')?.value || this.currentViewArgs[0] || new Date().toISOString().substring(0, 7);
        const department = document.getElementById('sal-department')?.value || this.currentViewArgs[1] || 'VP';
        
        const employee = AppData.getEmployee(employeeId);
        if (!employee) return;
        
        const actualData = AppData.calculateActualSalaryForEmployee(employeeId, month, department);
        const companyCK = AppData.calculateDocumentedSalaryForEmployee(employeeId, month);
        
        const ts = AppData.getTimesheet(month, department);
        const companyAdvance = (ts && ts.salaryOverrides && ts.salaryOverrides[employeeId] && ts.salaryOverrides[employeeId].companyAdvance) !== undefined 
            ? ts.salaryOverrides[employeeId].companyAdvance 
            : 0;
            
        document.getElementById('settlement-modal-content').innerHTML = Views.settlementModal(employee, month, department, actualData, companyAdvance, companyCK);
        this.openModal('settlement-modal');
    },
    calculateSettlementLive() {
        const advanceInput = document.getElementById('settle-advance');
        if (!advanceInput) return;
        
        const advance = Number(advanceInput.value) || 0;
        const payment = Number(advanceInput.dataset.payment) || 0;
        const companyCK = Number(advanceInput.dataset.companyck) || 0;
        
        const result = companyCK + advance - payment;
        
        const resultCell = document.getElementById('settle-result-cell');
        if (resultCell) {
            resultCell.innerText = AppData.formatCurrency(result);
            if (result < 0) {
                resultCell.style.color = 'var(--info)';
            } else {
                resultCell.style.color = 'var(--rose)';
            }
        }
    },
    saveSettlement(employeeId, month, department) {
        const advanceInput = document.getElementById('settle-advance');
        if (!advanceInput) return;
        
        const advanceValue = advanceInput.value !== '' ? Number(advanceInput.value) : 0;
        
        let ts = AppData.getTimesheet(month, department);
        if (!ts) {
            ts = { month, department, attendance: {}, voyageCount: 0 };
        }
        if (!ts.salaryOverrides) {
            ts.salaryOverrides = {};
        }
        if (!ts.salaryOverrides[employeeId]) {
            ts.salaryOverrides[employeeId] = {};
        }
        
        ts.salaryOverrides[employeeId].companyAdvance = advanceValue;
        AppData.saveTimesheet(ts);
        
        alert('Đã lưu thành công số tiền ứng công ty!');
        this.closeModal('settlement-modal');
        this.navigate('salary', month, department, app.salaryTab || 'thucte');
    },
    sendZaloSettlement(employeeId, month, department) {
        const employee = AppData.getEmployee(employeeId);
        if (!employee) return;
        
        const phone = employee.phone ? String(employee.phone).trim() : '';
        if (!phone) {
            alert('Thuyền viên này chưa có số điện thoại Zalo. Vui lòng cập nhật số điện thoại trong mục Quản lý nhân sự.');
            return;
        }
        
        const actualData = AppData.calculateActualSalaryForEmployee(employeeId, month, department);
        const companyCK = AppData.calculateDocumentedSalaryForEmployee(employeeId, month);
        
        const advanceInput = document.getElementById('settle-advance');
        const advance = advanceInput ? (Number(advanceInput.value) || 0) : 0;
        
        const payment = actualData.payment;
        const settlement = companyCK + advance - payment;
        
        const [yyyy, mm] = month.split('-');
        const monthYearStr = `${mm}/${yyyy}`;
        
        const vesselName = AppData.getVessels().find(v => v.id === department)?.name || department;
        
        const message = `BẢNG QUYẾT TOÁN LƯƠNG THÁNG ${monthYearStr}
Thuyền viên: ${employee.name}
Tàu: Vũ Gia ${vesselName}
---------------------------------
- Mức lương thực tế (1): ${AppData.formatCurrency(actualData.actual)}đ
- Ngày công: ${actualData.workingDays}/${actualData.daysInMonth}
- Bảo hiểm (2): ${AppData.formatCurrency(actualData.insurance)}đ
- Lương thực lĩnh (1-2): ${AppData.formatCurrency(payment)}đ
- Ứng công ty: ${AppData.formatCurrency(advance)}đ
- Công ty CK: ${AppData.formatCurrency(companyCK)}đ
---------------------------------
=> Quyết toán: ${AppData.formatCurrency(settlement)}đ

(Công ty CK: ${AppData.formatCurrency(companyCK)}đ + Ứng công ty: ${AppData.formatCurrency(advance)}đ - Lương thực lĩnh: ${AppData.formatCurrency(payment)}đ = Quyết toán: ${AppData.formatCurrency(settlement)}đ)`;

        navigator.clipboard.writeText(message).then(() => {
            alert(`Đã sao chép bảng quyết toán lương của ${employee.name} vào bộ nhớ tạm.\nHệ thống sẽ tự động chuyển hướng sang Zalo để gửi tin nhắn.`);
            
            let formattedPhone = phone.replace(/[^0-9+]/g, '');
            if (formattedPhone.startsWith('+84')) {
                formattedPhone = '0' + formattedPhone.substring(3);
            }
            window.open(`https://zalo.me/${formattedPhone}`, '_blank');
        }).catch(err => {
            console.error('Lỗi khi sao chép vào bộ nhớ tạm:', err);
            alert('Không thể tự động sao chép bảng quyết toán. Vui lòng copy thông tin sau để gửi:\n\n' + message);
        });
    },
    bulkUpdateJoinDate(date) {
        if (AppData.state && AppData.state.employees) {
            AppData.state.employees.forEach(emp => {
                emp.joinDate = date;
            });
            AppData.save();
            localStorage.setItem('employees_joindate_migration_2026_v2', 'true');
            alert('Đã đặt ngày vào tàu thành ' + date + ' cho tất cả nhân sự!');
            this.navigate('hr');
        }
    },
    bulkUpdateCrewAllowances() {
        if (AppData.state && AppData.state.employees) {
            AppData.state.employees.forEach(emp => {
                if (emp.department !== 'VP') {
                    emp.phoneAllowance = 2500000;
                    emp.clothingAllowance = 400000;
                    emp.transportAllowance = 2500000;
                }
            });
            AppData.save();
            localStorage.setItem('employees_crew_allowances_migration_2026', 'true');
            alert('Đã cập nhật phụ cấp Điện thoại 2.5M, Trang phục 400k, Xăng xe 2.5M cho tất cả thuyền viên!');
            this.navigate('hr');
        }
    },

    loadSalaryView() {
        const month = document.getElementById('sal-month')?.value;
        const dep = document.getElementById('sal-department')?.value;
        this.navigate('salary', month, dep, app.salaryTab || 'thucte');
    },

    updateVoyageCount() {
        const month = document.getElementById('sal-month')?.value;
        const dep = document.getElementById('sal-department')?.value;
        const count = Number(document.getElementById('sal-voyage-count')?.value) || 0;
        let ts = AppData.getTimesheet(month, dep);
        if (!ts) {
            ts = { month, department: dep, attendance: {}, voyageCount: 0 };
        }
        ts.voyageCount = count;
        AppData.saveTimesheet(ts);
        this.navigate('salary', month, dep, 'chungtu');
    },

    updateDependentDeductionRate() {
        const month = document.getElementById('sal-month')?.value;
        const dep = document.getElementById('sal-department')?.value;
        const rate = Number(document.getElementById('sal-dependent-deduction-rate')?.value) || 0;
        let ts = AppData.getTimesheet(month, dep);
        if (!ts) {
            ts = { month, department: dep, attendance: {}, voyageCount: 0 };
        }
        ts.dependentDeductionRate = rate;
        AppData.saveTimesheet(ts);
        app.salaryTab = 'chungtu';
        this.navigate('salary', month, dep, 'chungtu');
    },

    updateSalaryOverride(employeeId, field, value) {
        const month = document.getElementById('sal-month')?.value;
        const dep = document.getElementById('sal-department')?.value;
        let ts = AppData.getTimesheet(month, dep);
        if (!ts) {
            ts = { month, department: dep, attendance: {}, voyageCount: 0 };
        }
        if (!ts.salaryOverrides) {
            ts.salaryOverrides = {};
        }
        if (!ts.salaryOverrides[employeeId]) {
            ts.salaryOverrides[employeeId] = {};
        }
        
        // Kiểm tra rộng hơn để đảm bảo khi xóa trống ô nhập liệu sẽ khôi phục mặc định
        if (value === '' || value === undefined || value === null || String(value).trim() === '' || isNaN(Number(value))) {
            if (ts.salaryOverrides[employeeId]) {
                delete ts.salaryOverrides[employeeId][field];
                if (Object.keys(ts.salaryOverrides[employeeId]).length === 0) {
                    delete ts.salaryOverrides[employeeId];
                }
            }
        } else {
            ts.salaryOverrides[employeeId][field] = Number(value);
        }
        
        AppData.saveTimesheet(ts);
        app.salaryTab = 'chungtu';
        this.navigate('salary', month, dep, 'chungtu');
    },

    toggleAttendanceDay(employeeId, dayIndex, isChecked) {
        const month = document.getElementById('sal-month')?.value;
        const dep = document.getElementById('sal-department')?.value;
        let ts = AppData.getTimesheet(month, dep);
        if (!ts) return; // Should not happen
        
        if (ts.attendance[employeeId] && ts.attendance[employeeId].length > dayIndex) {
            ts.attendance[employeeId][dayIndex] = isChecked;
            AppData.saveTimesheet(ts);
            // Re-render view to update calculations
            this.navigate('salary', month, dep);
        }
    },

    openTransactionModal() {
        document.getElementById('trans-modal-content').innerHTML = Views.transModal();
        document.getElementById('t-id').value = '';
        
        // Initialize custom autocomplete for partner select
        const list = [...AppData.getVendors(), ...AppData.getCustomers()];
        const uniqueNames = Array.from(new Set(list.map(p => p.name).filter(Boolean))).sort();
        this.initAutocomplete('t-partner', uniqueNames, () => this.onTransactionPartnerChange());

        this.openModal('trans-modal');
    },
    saveTransaction() {
        const tId = document.getElementById('t-id').value;
        const t = {
            id: tId || null,
            date: document.getElementById('t-date').value,
            vessel: document.getElementById('t-vessel').value,
            category: document.getElementById('t-cat').value,
            voyageNo: document.getElementById('t-voyage').value,
            contractNo: document.getElementById('t-contract').value,
            partner: document.getElementById('t-partner').value,
            content: document.getElementById('t-content').value,
            thu: Number(document.getElementById('t-thu').value) || 0,
            chi: Number(document.getElementById('t-chi').value) || 0,
            account: document.getElementById('t-acc').value
        };
        AppData.addTransaction(t);
        this.closeModal('trans-modal');
        if (this.currentView === 'debts') {
            this.navigate('debts', this.currentDebtTab || 'customer');
        } else {
            this.navigate('financials');
        }
    },
    editTransaction(id) {
        const trans = AppData.state.transactions.find(t => t.id === id);
        if(!trans) return;
        document.getElementById('trans-modal-content').innerHTML = Views.transModal();
        document.getElementById('t-id').value = trans.id;
        document.getElementById('t-date').value = trans.date;
        document.getElementById('t-vessel').value = trans.vessel;
        document.getElementById('t-cat').value = trans.category;
        
        document.getElementById('t-voyage').value = trans.voyageNo || '';
        document.getElementById('t-partner').value = trans.partner;
        this.onTransactionCatChange();
        if (trans.category === 'CVC') {
            document.getElementById('t-contract').value = trans.contractNo || '';
        }
        document.getElementById('t-content').value = trans.content;
        document.getElementById('t-thu').value = trans.thu;
        document.getElementById('t-chi').value = trans.chi;
        document.getElementById('t-acc').value = trans.account;

        // Initialize custom autocomplete for partner select
        const list = [...AppData.getVendors(), ...AppData.getCustomers()];
        const uniqueNames = Array.from(new Set(list.map(p => p.name).filter(Boolean))).sort();
        this.initAutocomplete('t-partner', uniqueNames, () => this.onTransactionPartnerChange());

        this.openModal('trans-modal');
    },
    deleteTransaction(id) {
        if (confirm('Bạn có chắc muốn xóa giao dịch này?')) {
            AppData.deleteTransaction(id);
            if (this.currentView === 'debts') {
                this.navigate('debts', this.currentDebtTab || 'customer');
            } else {
                this.navigate('financials');
            }
        }
    },
    onTransactionCatChange() {
        const cat = document.getElementById('t-cat').value;
        const wrapper = document.getElementById('t-contract-wrapper');
        const contractSelect = document.getElementById('t-contract');
        
        if (cat === 'CVC') {
            wrapper.style.display = 'block';
            const vesselId = document.getElementById('t-vessel').value;
            const partnerVal = document.getElementById('t-partner').value;
            
            const normalizeName = (name) => {
                if (!name) return '';
                return name.trim().toUpperCase().replace(/\s+/g, ' ');
            };

            const normalizedPartner = normalizeName(partnerVal);

            // Filter shipments by vessel first
            let filteredShipments = AppData.state.shipments.filter(s => s.vesselId === vesselId);
            
            // If partner is specified, filter by normalized partner name too
            if (normalizedPartner) {
                filteredShipments = filteredShipments.filter(s => normalizeName(s.customer) === normalizedPartner);
            }

            const getShipmentRemainingDebt = (shipment) => {
                const custName = normalizeName(shipment.customer);
                if (!custName) return Number(shipment.revenueInvoice || 0);

                const custShipments = AppData.state.shipments.filter(x => normalizeName(x.customer) === custName);
                const sortedShipments = [...custShipments].sort((a, b) => {
                    const dateA = a.dateStart || '';
                    const dateB = b.dateStart || '';
                    if (dateA !== dateB) return dateA.localeCompare(dateB);
                    return (a.contractNo || '').localeCompare(b.contractNo || '', undefined, {numeric: true, sensitivity: 'base'});
                });

                const custTrans = (AppData.state.transactions || []).filter(t => t.partner && normalizeName(t.partner) === custName);
                
                const explicitPaidMap = {};
                let unallocatedPaid = 0;
                
                custTrans.forEach(t => {
                    if (t.category === 'CVC') {
                        const matchedShipment = sortedShipments.find(x => x.contractNo && x.contractNo === t.contractNo);
                        if (matchedShipment) {
                            explicitPaidMap[matchedShipment.id] = (explicitPaidMap[matchedShipment.id] || 0) + (Number(t.thu) || 0);
                        } else {
                            unallocatedPaid += (Number(t.thu) || 0);
                        }
                    }
                });

                const openingDebt = AppData.state.company.customerOpeningDebts ? (Number(AppData.state.company.customerOpeningDebts[shipment.customer]) || Number(AppData.state.company.customerOpeningDebts[custName]) || 0) : 0;
                let remainingPaid = unallocatedPaid;
                remainingPaid -= openingDebt;
                if (remainingPaid < 0) remainingPaid = 0;

                let targetDebt = 0;
                for (let i = 0; i < sortedShipments.length; i++) {
                    const curr = sortedShipments[i];
                    let invoiceAmt = Number(curr.revenueInvoice) || 0;
                    let explicitPaid = explicitPaidMap[curr.id] || 0;
                    let paidForThis = explicitPaid;
                    
                    if (remainingPaid > 0) {
                        if (i === sortedShipments.length - 1) {
                            paidForThis += remainingPaid;
                            remainingPaid = 0;
                        } else if (invoiceAmt > paidForThis) {
                            let gap = invoiceAmt - paidForThis;
                            let add = Math.min(remainingPaid, gap);
                            paidForThis += add;
                            remainingPaid -= add;
                        }
                    }
                    if (curr.id === shipment.id) {
                        targetDebt = Math.max(0, Math.round(invoiceAmt - paidForThis));
                        break;
                    }
                }
                return targetDebt;
            };

            const sortedOptions = filteredShipments.map(s => {
                const debt = getShipmentRemainingDebt(s);
                return {
                    contractNo: s.contractNo,
                    debt: debt,
                    label: s.contractNo + (debt > 0 ? ` (Còn nợ: ${AppData.formatCurrency(debt)})` : ' (Hết nợ)')
                };
            }).sort((a, b) => {
                // Unpaid contracts first
                if (a.debt > 0 && b.debt <= 0) return -1;
                if (a.debt <= 0 && b.debt > 0) return 1;
                // Otherwise sort by contract number
                return a.contractNo.localeCompare(b.contractNo, undefined, {numeric: true, sensitivity: 'base'});
            });

            // Save currently selected contract value
            const currentVal = contractSelect.value;
            
            contractSelect.innerHTML = '<option value="">-- Chọn Mã HĐ --</option>' + 
                sortedOptions.map(opt => `<option value="${opt.contractNo}">${opt.label}</option>`).join('');

            // Restore selection if it still exists in the new options list
            if (currentVal && sortedOptions.some(opt => opt.contractNo === currentVal)) {
                contractSelect.value = currentVal;
            }
        } else {
            wrapper.style.display = 'none';
            contractSelect.value = '';
        }
    },
    onTransactionPartnerChange() {
        this.onTransactionCatChange();
    },

    // Fuel Actions
    openFuelVoyageModal(vesselId, voyageId) {
        document.getElementById('fuel-voyage-modal-content').innerHTML = Views.fuelVoyageModal(vesselId, voyageId);
        
        // Initialize custom autocomplete for Fuel Vendor
        this.initAutocomplete('fv-vendor', AppData.getVendors().map(v => v.name));

        this.openModal('fuel-voyage-modal');
    },
    saveFuelVoyage() {
        const id = document.getElementById('fv-id').value;
        const vesselId = document.getElementById('fv-vessel-id').value;
        const fvNo = document.getElementById('fv-no').value;
        
        const existingNo = AppData.findFuelVoyageByVesselAndNo(vesselId, fvNo);
        if (existingNo && existingNo.id !== id) {
            alert(`Lỗi: Chuyến ${fvNo} đã tồn tại cho tàu này!`);
            return;
        }

        const voyage = {
            id: id || null,
            vesselId: vesselId,
            voyageNo: fvNo,
            cargoType: document.getElementById('fv-cargo').value,
            addedFuel: Number(document.getElementById('fv-added').value) || 0,
            fuelUnitPrice: Number(document.getElementById('fv-price').value) || 0,
            fuelDate: document.getElementById('fv-date').value,
            fuelVendor: document.getElementById('fv-vendor').value,
            fuelLocation: document.getElementById('fv-location').value
        };
        const existing = AppData.getFuelVoyage(id);
        if(existing) {
            voyage.initialFuel = existing.initialFuel;
        }
        AppData.addFuelVoyage(voyage);
        this.closeModal('fuel-voyage-modal');
        this.navigate('fuel', vesselId);
    },
    updateInitialFuel(voyageId, value) {
        const voy = AppData.getFuelVoyage(voyageId);
        if (voy) {
            voy.initialFuel = Number(value) || 0;
            AppData.save();
            this.navigate('fuel', voy.vesselId);
        }
    },
    deleteFuelVoyage(id) {
        const v = AppData.getFuelVoyage(id);
        if (confirm(`Bạn có chắc muốn xóa chuyến ${v.voyageNo} và toàn bộ các chặng thuộc chuyến này?`)) {
            const vesselId = v.vesselId;
            AppData.deleteFuelVoyage(id);
            this.navigate('fuel', vesselId);
        }
    },

    saveLOConfig(vesselId) {
        const loHours = Number(document.getElementById('lo-hours').value) || 800;
        const loRepl = Number(document.getElementById('lo-repl-qty').value) || 8;
        const loTopup = Number(document.getElementById('lo-topup-qty').value) || 3;
        
        AppData.updateVessel(vesselId, {
            loHours: loHours,
            loReplacementQty: loRepl,
            loTopupQty: loTopup
        });
        
        AppData.recalculateAllShipments();
        alert('Đã lưu cấu hình định mức dầu LO và tự động tính toán lại chi phí cho các chuyến hàng!');
        this.navigate('fuel', vesselId, 'LO');
    },

    saveLOSupply(vesselId) {
        const date = document.getElementById('lo-supply-date').value;
        const vendor = document.getElementById('lo-supply-vendor').value.trim();
        const qty = Number(document.getElementById('lo-supply-qty').value) || 0;
        const price = Number(document.getElementById('lo-supply-price').value) || 0;
        
        if (!date || !vendor || qty <= 0 || price <= 0) {
            alert('Vui lòng nhập đầy đủ và chính xác thông tin phiếu cấp!');
            return;
        }

        const supply = {
            vesselId: vesselId,
            date: date,
            vendor: vendor,
            qty: qty,
            price: price
        };
        
        AppData.addLOSupply(supply);
        AppData.recalculateAllShipments();
        alert('Đã thêm phiếu cấp dầu LO mới và tự động tính toán lại chi phí cho các chuyến hàng!');
        this.navigate('fuel', vesselId, 'LO');
    },

    deleteLOSupply(id, vesselId) {
        if (confirm('Bạn có chắc chắn muốn xóa phiếu cấp dầu LO này?')) {
            AppData.deleteLOSupply(id);
            AppData.recalculateAllShipments();
            this.navigate('fuel', vesselId, 'LO');
        }
    },

    formatDateTimeLocal(str) {
        if (!str) return '';
        str = String(str).trim();
        if (!str || str === '---') return '';
        
        // If it's already in YYYY-MM-DDTHH:mm format
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
            return str.substring(0, 16);
        }
        
        // Try to match MM/DD/YYYY HH:mm or DD/MM/YYYY HH:mm
        const parts = str.split(/[\s,T]+/);
        if (parts.length >= 2) {
            const datePart = parts[0];
            const timePart = parts[1];
            
            const dateSubparts = datePart.split('/');
            if (dateSubparts.length === 3) {
                let dVal = Number(dateSubparts[0]);
                let mVal = Number(dateSubparts[1]);
                let yVal = Number(dateSubparts[2]);
                
                // Determine day vs month
                let day, month, year;
                if (dVal > 12) {
                    day = dVal;
                    month = mVal;
                    year = yVal;
                } else if (mVal > 12) {
                    day = mVal;
                    month = dVal;
                    year = yVal;
                } else {
                    // Ambiguous. Default to MM/DD/YYYY, or let Date try to parse it
                    day = dVal;
                    month = mVal;
                    year = yVal;
                    
                    const testD = new Date(str);
                    if (!isNaN(testD.getTime())) {
                        const yr = testD.getFullYear();
                        const mt = String(testD.getMonth() + 1).padStart(2, '0');
                        const dy = String(testD.getDate()).padStart(2, '0');
                        const hr = String(testD.getHours()).padStart(2, '0');
                        const min = String(testD.getMinutes()).padStart(2, '0');
                        return `${yr}-${mt}-${dy}T${hr}:${min}`;
                    }
                }
                
                // Format time part
                const timeSubparts = timePart.split(':');
                let hours = 0;
                let minutes = 0;
                if (timeSubparts.length >= 2) {
                    hours = Number(timeSubparts[0]);
                    minutes = Number(timeSubparts[1]);
                }
                
                if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hours) && !isNaN(minutes)) {
                    const pad = (n) => String(n).padStart(2, '0');
                    return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
                }
            }
        }
        
        // General fallback using Date
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        
        return '';
    },

    openFuelLogModal(voyageId, logId) {
        document.getElementById('fuel-modal-content').innerHTML = Views.fuelModal(voyageId);
        document.getElementById('f-id').value = logId || '';
        if (logId) {
            const log = AppData.state.fuelLogs.find(l => l.id === logId);
            if (log) {
                document.getElementById('f-start-time').value = this.formatDateTimeLocal(log.startTime);
                document.getElementById('f-start-pos').value = log.startPos || '';
                document.getElementById('f-end-time').value = this.formatDateTimeLocal(log.endTime);
                document.getElementById('f-end-pos').value = log.endPos || '';
                document.getElementById('f-fuel-rate').value = log.fuelRate;
                document.getElementById('f-hours').value = log.hours;
            }
        } else {
            const voy = AppData.getFuelVoyage(voyageId);
            const v = AppData.getVessel(voy.vesselId);
            document.getElementById('f-fuel-rate').value = v ? v.fuelRate : 150;
        }
        this.openModal('fuel-modal');
    },
    calcFuelLogHours() {
        const start = document.getElementById('f-start-time').value;
        const end = document.getElementById('f-end-time').value;
        if (start && end) {
            const s = new Date(start);
            const e = new Date(end);
            const hours = Math.abs(e - s) / (1000 * 60 * 60);
            document.getElementById('f-hours').value = hours.toFixed(2);
        } else {
            document.getElementById('f-hours').value = '0';
        }
    },
    saveFuelLog() {
        const fId = document.getElementById('f-id').value;
        const voyId = document.getElementById('f-voyage-id').value;
        const voy = AppData.getFuelVoyage(voyId);
        
        const log = {
            id: fId || null,
            fuelVoyageId: voyId,
            startTime: document.getElementById('f-start-time').value,
            startPos: document.getElementById('f-start-pos').value,
            endTime: document.getElementById('f-end-time').value,
            endPos: document.getElementById('f-end-pos').value,
            fuelRate: Number(document.getElementById('f-fuel-rate').value) || 0,
            hours: document.getElementById('f-hours').value
        };
        AppData.addFuelLog(log);
        this.closeModal('fuel-modal');
        this.navigate('fuel', voy.vesselId);
    },
    editFuelLog(voyageId, logId) {
        this.openFuelLogModal(voyageId, logId);
    },
    deleteFuelLog(id) {
        const log = AppData.state.fuelLogs.find(l => l.id === id);
        if(!log) return;
        const voy = AppData.getFuelVoyage(log.fuelVoyageId);
        if (confirm('Bạn có chắc muốn xóa chặng này?')) {
            AppData.deleteFuelLog(id);
            this.navigate('fuel', voy.vesselId);
        }
    },

    // Monthly Cost Actions
    loadMonthlyCosts() {
        const month = document.getElementById('m-month').value;
        const vesselId = document.getElementById('m-vessel').value;
        this.lastMonthlyCostsMonth = month;
        this.lastMonthlyCostsVesselId = vesselId;
        const costs = AppData.getMonthlyCosts(month, vesselId);
        document.getElementById('m-salary').value = costs.salary || 0;
        document.getElementById('m-ins').value = costs.insurance || 0;
        document.getElementById('m-food').value = costs.food || 0;
        document.getElementById('m-material-company').value = costs.materialCompany || 0;
        document.getElementById('m-material-vessel').value = costs.materialVessel || 0;
        document.getElementById('m-loan-interest').value = costs.loanInterest || 0;
        document.getElementById('m-loan-interest-external').value = costs.loanInterestExternal || 0;
        document.getElementById('m-other').value = costs.other || 0;
    },
    saveMonthlyCosts() {
        const month = document.getElementById('m-month').value;
        const vesselId = document.getElementById('m-vessel').value;
        this.lastMonthlyCostsMonth = month;
        this.lastMonthlyCostsVesselId = vesselId;
        const data = {
            month,
            vesselId,
            salary: Number(document.getElementById('m-salary').value) || 0,
            insurance: Number(document.getElementById('m-ins').value) || 0,
            food: Number(document.getElementById('m-food').value) || 0,
            materialCompany: Number(document.getElementById('m-material-company').value) || 0,
            materialVessel: Number(document.getElementById('m-material-vessel').value) || 0,
            loanInterest: Number(document.getElementById('m-loan-interest').value) || 0,
            loanInterestExternal: Number(document.getElementById('m-loan-interest-external').value) || 0,
            other: Number(document.getElementById('m-other').value) || 0
        };
        
        // Detect manual modifications to loanInterest against ledger transactions total
        const transactionInterest = (AppData.state.transactions || [])
            .filter(t => t.vessel === vesselId && t.category === '6.Lãi Vay' && t.date && t.date.substring(0, 7) === month)
            .reduce((sum, t) => sum + (Number(t.chi) || 0), 0);
        data.isManualLoanInterest = (data.loanInterest !== transactionInterest);

        AppData.saveMonthlyCosts(data);
        // Recalculate daily allocations to voyages
        AppData.recalculateAllShipmentAllocations(vesselId, month);
        alert('Đã lưu chi phí tháng ' + data.month + ' cho tàu ' + data.vesselId + ' và tự động phân bổ lại cho các chuyến đi!');
    },
    loadAnnualCosts() {
        const year = document.getElementById('a-year').value;
        const vesselId = document.getElementById('a-vessel').value;
        this.annualCostsYear = year;
        this.annualCostsVesselId = vesselId;
        this.navigate('annual-costs');
    },
    saveAnnualCosts() {
        const year = Number(document.getElementById('a-year').value);
        const vesselId = document.getElementById('a-vessel').value;
        
        this.annualCostsYear = year;
        this.annualCostsVesselId = vesselId;
        
        const data = {
            year,
            vesselId,
            dockingIntermediateCost: Number(document.getElementById('a-docking-int-cost').value) || 0,
            dockingIntermediateYears: Number(document.getElementById('a-docking-int-years').value) || 2.5,
            dockingIntermediateDate: document.getElementById('a-docking-int-date').value || '',
            dockingPeriodicCost: Number(document.getElementById('a-docking-per-cost').value) || 0,
            dockingPeriodicYears: Number(document.getElementById('a-docking-per-years').value) || 5,
            dockingPeriodicDate: document.getElementById('a-docking-per-date').value || '',
            registryAnnualCost: Number(document.getElementById('a-registry-ann-cost').value) || 0,
            registryAnnualYears: Number(document.getElementById('a-registry-ann-years').value) || 1,
            registryAnnualDate: document.getElementById('a-registry-ann-date').value || '',
            depreciationCost: Number(document.getElementById('a-depreciation-cost').value) || 0,
            hullInsuranceCost: Number(document.getElementById('a-hull-ins-cost').value) || 0,
            largeRepairCost: Number(document.getElementById('a-large-repair-cost').value) || 0
        };
        AppData.saveAnnualCosts(data);
        alert('Đã lưu cấu hình chi phí năm ' + data.year + ' cho tàu ' + data.vesselId + ' và tự động phân bổ lại cho toàn bộ chuyến đi!');
        this.navigate('annual-costs');
    },

    // Shipment Actions
    openShipmentModal() { 
        document.getElementById('ship-modal-content').innerHTML = Views.shipModal();
        const loInput = document.getElementById('s-c-fuel-lo');
        if (loInput) loInput.dataset.isOverridden = 'false';
        
        // Auto-fill defaults for new shipment
        document.getElementById('s-contract-no').value = AppData.getNextContractNo();
        this.suggestCommissionRate();
        const firstVessel = document.getElementById('s-vessel-id').value;
        if (firstVessel) {
            document.getElementById('s-voy-no').value = AppData.getNextVoyageNo(firstVessel);
            const loadDate = AppData.getNextLoadDate(firstVessel);
            if (loadDate) document.getElementById('s-start').value = loadDate;
            
            // Sync fuel details if the new voyage number exists in fuel logs
            setTimeout(() => {
                this.syncShipmentFuel();
            }, 0);
        }

        // Initialize autocompletes
        this.initAutocomplete('s-customer', AppData.getCustomers().map(c => c.name));
        this.initAutocomplete('s-cargo', AppData.getCargos());
        this.initAutocomplete('s-p-load', AppData.getPorts(), () => this.calcBrokerage());
        this.initAutocomplete('s-p-dis', AppData.getPorts(), () => this.calcBrokerage());

        this.openModal('ship-modal'); 
    },
    
    handleShipmentVesselChange() {
        if (!document.getElementById('s-id').value) {
            const vesselId = document.getElementById('s-vessel-id').value;
            document.getElementById('s-voy-no').value = AppData.getNextVoyageNo(vesselId);
            const loadDate = AppData.getNextLoadDate(vesselId);
            if (loadDate) document.getElementById('s-start').value = loadDate;
        }
        this.syncShipmentFuel();
    },
    
    calcShipmentFinance() {
        const qty = Number(document.getElementById('s-qty').value) || 0;
        const rate = Number(document.getElementById('s-rate').value) || 0;
        const markup = Number(document.getElementById('s-markup').value) || 0;
        const commRateVal = document.getElementById('s-commission-rate').value;
        const customRate = commRateVal !== '' ? Number(commRateVal) : undefined;
        const fuelP = Number(document.getElementById('s-fuel-p').value) || 0;
        
        const revReal = qty * rate;
        const revInvoice = (rate + markup) * qty;
        const contractNo = document.getElementById('s-contract-no').value;
        const refund = AppData.calcRefund(revInvoice, revReal, contractNo, customRate);
        
        document.getElementById('val-rev-real').innerText = AppData.formatCurrency(revReal);
        document.getElementById('val-rev-inv').innerText = AppData.formatCurrency(revInvoice);
        document.getElementById('val-refund').innerText = AppData.formatCurrency(refund);
        
        // Update fuel cost if hours are loaded
        const hours = Number(document.getElementById('s-c-hours').value) || 0;
        const vesselId = document.getElementById('s-vessel-id').value;
        const vessel = AppData.getVessel(vesselId);
        const voyNo = document.getElementById('s-voy-no')?.value;
        
        let fuelCost = 0;
        let fuelVoy = null;
        if (vesselId && voyNo) {
            fuelVoy = AppData.findFuelVoyageByVesselAndNo(vesselId, voyNo);
        }
        
        if (fuelVoy) {
            // Lấy chính xác từ chi tiết các chặng (Fuel Logs) nếu đã có
            const stats = AppData.getFuelVoyageStats(fuelVoy.id);
            let price = Number(stats.fuelPrice) || fuelP;
            fuelCost = Math.round(stats.totalFuel * price);
            document.getElementById('s-c-fuel').value = fuelCost;
        } else if (vessel) {
            // Tạm tính dựa trên định mức chung nếu chưa có chi tiết chặng
            fuelCost = hours * vessel.fuelRate * fuelP;
            document.getElementById('s-c-fuel').value = fuelCost;
        }

        // Calculate LO cost automatically if hours and vessel configuration are available and not overridden
        const loInput = document.getElementById('s-c-fuel-lo');
        let fuelLO = 0;
        if (loInput) {
            fuelLO = Number(loInput.value) || 0;
            if (vessel && loInput.dataset.isOverridden !== 'true') {
                const loHours = Number(vessel.loHours) || 800;
                const loRepl = Number(vessel.loReplacementQty) || 8;
                const loTopup = Number(vessel.loTopupQty) || 3;
                const dateStart = document.getElementById('s-start')?.value || new Date().toISOString().split('T')[0];
                const loPrice = AppData.getLastLOPrice(vesselId, dateStart);
                const hourlyLORate = loHours > 0 ? ((loRepl + loTopup) / loHours) : 0;
                fuelLO = Math.round(hours * hourlyLORate * loPrice);
                loInput.value = fuelLO;
                
                // Trigger input event for formatted output if excel-input setup is active
                if (loInput.dataset.excelInput === 'true') {
                    loInput.value = fuelLO;
                }
            }
        }

        // Calculate VAT: 8% Doanh Thu hoá đơn - 8% (Dầu DO + Dầu LO + Đại lý 2 đầu + Hoa tiêu, phí cảng)
        const agent = Number(document.getElementById('s-c-agent')?.value) || 0;
        const portFees = Number(document.getElementById('s-c-port-fees')?.value) || 0;
        const deduc = fuelCost + fuelLO + agent + portFees;
        const vat = (0.08 * revInvoice) - (0.08 * deduc);
        document.getElementById('s-c-vat').value = Math.round(vat);

        this.calcBrokerage();
    },
    
    suggestCommissionRate() {
        const cust = (document.getElementById('s-customer')?.value || '').toLowerCase();
        const contract = (document.getElementById('s-contract-no')?.value || '').toUpperCase();
        const rateInput = document.getElementById('s-commission-rate');
        if (!rateInput) return;
        
        if (cust.includes('bình minh') || cust.includes('binh minh') || cust.includes('thái bình dương') || cust.includes('thai binh duong') || contract === 'HD25' || contract === 'HD54') {
            rateInput.value = 20;
        } else {
            rateInput.value = 28;
        }
        this.calcShipmentFinance();
    },

    handleFuelLOInput() {
        const loInput = document.getElementById('s-c-fuel-lo');
        if (loInput) {
            loInput.dataset.isOverridden = 'true';
        }
        this.calcShipmentFinance();
    },

    getPortRegion(portName) {
        if (!portName) return '';
        const p = portName.toLowerCase();
        if (p.includes('hải phòng') || p.includes('hải dương') || p.includes('quảng ninh')) return 'NORTH';
        if (p.includes('hòn la') || p.includes('nghi sơn') || p.includes('hà tĩnh') || p.includes('vũng áng')) return 'NORTH_CENTRAL';
        if (p.includes('đà nẵng') || p.includes('vinh') || p.includes('thanh hóa') || p.includes('quảng bình') || p.includes('chân mây')) return 'CENTRAL';
        if (p.includes('nha trang') || p.includes('cam ranh') || p.includes('quy nhơn')) return 'SOUTH_CENTRAL';
        if (p.includes('sài gòn') || p.includes('vũng tàu') || p.includes('long an') || p.includes('đồng nai') || p.includes('phú mỹ') || p.includes('hcm')) return 'SOUTH';
        if (p.includes('cần thơ') || p.includes('an giang') || p.includes('vĩnh xương') || p.includes('hậu giang') || p.includes('miền tây')) return 'MEKONG';
        return '';
    },

    calcBrokerage() {
        const pLoad = document.getElementById('s-p-load').value;
        const pDis = document.getElementById('s-p-dis').value;
        const vesselId = document.getElementById('s-vessel-id').value;
        const coefA = Number(document.getElementById('s-coef-a')?.value || 2.0);
        
        const r1 = this.getPortRegion(pLoad);
        const r2 = this.getPortRegion(pDis);
        
        let L = 0;
        const pair = [r1, r2].sort().join('-');
        
        const rates = {
            'CENTRAL-NORTH': 300000,
            'NORTH-SOUTH_CENTRAL': 350000,
            'NORTH-SOUTH': 400000,
            'MEKONG-NORTH': 500000,
            'NORTH_CENTRAL-SOUTH': 350000,
            'MEKONG-NORTH_CENTRAL': 450000,
            // Estimated intermediate routes
            'CENTRAL-MEKONG': 400000,
            'CENTRAL-SOUTH': 300000,
            'SOUTH-MEKONG': 200000
        };
        
        L = rates[pair] || 300000; // Default to 300k if not found
        
        const crewCount = (vesselId === 'VG18') ? 12 : 11;
        const W = 1.5; // Default for full load
        
        const totalBrokerage = L * W * coefA * crewCount;
        
        // Prevent overwriting if exact value exists in Captain's Report
        const sId = document.getElementById('s-id')?.value;
        const voyageNo = document.getElementById('s-voy-no')?.value;
        const start = document.getElementById('s-start')?.value;
        
        if (sId && voyageNo && start && vesselId) {
            const monthStr = start.substring(0, 7);
            const report = AppData.getCaptainReport(vesselId, monthStr);
            if (report && report.brokerages) {
                const exactBrokerage = report.brokerages.find(b => b.voyageNo === voyageNo);
                if (exactBrokerage) {
                    // Skip overwriting, keep the exact value from report
                    return;
                }
            }
        }

        const field = document.getElementById('s-c-brokerage');
        if (field) field.value = Math.round(totalBrokerage);
    },

    calcShipmentAllocations() {
        const start = document.getElementById('s-start').value;
        const end = document.getElementById('s-end').value;
        const vId = document.getElementById('s-vessel-id').value;
        if (!start || !end || !vId) return;

        const allocate = (field) => AppData.calcExactAllocation(start, end, vId, field);

        document.getElementById('s-c-sal').value = allocate('salary');
        document.getElementById('s-c-food').value = allocate('food');
        document.getElementById('s-c-ins').value = allocate('insurance');
        document.getElementById('s-c-m-mat-company').value = allocate('materialCompany');
        document.getElementById('s-c-m-mat-vessel').value = allocate('materialVessel');
        document.getElementById('s-c-m-other').value = allocate('other');
        document.getElementById('s-c-loan-interest').value = allocate('loanInterest');
        document.getElementById('s-c-loan-interest-external').value = allocate('loanInterestExternal');

        // New annual cost allocations
        const annualAlloc = AppData.calcAnnualAllocation(start, end, vId);
        document.getElementById('s-c-docking-int').value = annualAlloc.dockingIntermediate;
        document.getElementById('s-c-docking-per').value = annualAlloc.dockingPeriodic;
        document.getElementById('s-c-registry-ann').value = annualAlloc.registryAnnual;
        document.getElementById('s-c-depreciation').value = annualAlloc.depreciation;
        document.getElementById('s-c-hull-insurance').value = annualAlloc.hullInsurance;
        document.getElementById('s-c-large-repair').value = annualAlloc.largeRepair;
    },

    syncShipmentFuel() {
        const vId = document.getElementById('s-vessel-id').value;
        const voyNo = document.getElementById('s-voy-no').value;
        if (!vId || !voyNo) return;

        const fuelVoy = AppData.findFuelVoyageByVesselAndNo(vId, voyNo);
        if (fuelVoy) {
            const stats = AppData.getFuelVoyageStats(fuelVoy.id);
            document.getElementById('s-c-hours').value = stats.totalHours.toFixed(1);
            
            let price = Number(stats.fuelPrice);
            if (price === 0) {
                price = AppData.getLastFuelPrice(vId, voyNo);
            }
            document.getElementById('s-fuel-p').value = price;
            
            if (fuelVoy.cargoType) {
                document.getElementById('s-cargo').value = fuelVoy.cargoType;
                // Update brokerage since cargo changed
                if (typeof this.calcBrokerage === 'function') {
                    this.calcBrokerage();
                }
            }
            
            this.calcShipmentFinance();
            console.log(`Synced fuel data for voyage ${voyNo} on vessel ${vId} (Price: ${price})`);
        } else {
            const price = AppData.getLastFuelPrice(vId, voyNo);
            document.getElementById('s-fuel-p').value = price;
            this.calcShipmentFinance();
            console.log(`No fuel voyage record for voyage ${voyNo} on vessel ${vId}. Set fallback price to ${price}`);
        }
    },

    saveShipment() {
        const sId = document.getElementById('s-id').value;
        const s = {
            id: sId || ('S' + Date.now()),
            contractNo: document.getElementById('s-contract-no').value,
            voyageNo: document.getElementById('s-voy-no').value,
            vesselId: document.getElementById('s-vessel-id').value,
            customer: document.getElementById('s-customer').value,
            cargo: document.getElementById('s-cargo').value,
            portLoad: document.getElementById('s-p-load').value,
            portDischarge: document.getElementById('s-p-dis').value,
            dateStart: document.getElementById('s-start').value,
            dateEnd: document.getElementById('s-end').value,
            reportMonth: document.getElementById('s-report-month').value || '',
            qty: Number(document.getElementById('s-qty').value) || 0,
            rate: Number(document.getElementById('s-rate').value) || 0,
            markup: Number(document.getElementById('s-markup').value) || 0,
            commissionRate: Number(document.getElementById('s-commission-rate').value) || 0,
            fuelPrice: Number(document.getElementById('s-fuel-p').value) || 0,
            fuelHours: Number(document.getElementById('s-c-hours').value) || 0,
            revenueReal: Number(document.getElementById('val-rev-real').innerText.replace(/[^0-9]/g,'')),
            revenueInvoice: Number(document.getElementById('val-rev-inv').innerText.replace(/[^0-9]/g,'')),
            refundAmount: Number(document.getElementById('val-refund').innerText.replace(/[^0-9]/g,'')),
            costs: {
                fuelDO: Number(document.getElementById('s-c-fuel').value) || 0,
                fuelLO: Number(document.getElementById('s-c-fuel-lo').value) || 0,
                crewSalary: Number(document.getElementById('s-c-sal').value) || 0,
                crewFood: Number(document.getElementById('s-c-food').value) || 0,
                crewInsurance: Number(document.getElementById('s-c-ins').value) || 0,
                materialCompany: Number(document.getElementById('s-c-m-mat-company').value) || 0,
                materialVessel: Number(document.getElementById('s-c-m-mat-vessel').value) || 0,
                monthlyOther: Number(document.getElementById('s-c-m-other').value) || 0,
                agent: Number(document.getElementById('s-c-agent').value) || 0,
                vessel2ends: Number(document.getElementById('s-c-vessel-2ends').value) || 0,
                brokerage: Number(document.getElementById('s-c-brokerage').value) || 0,
                vat: Number(document.getElementById('s-c-vat').value) || 0,
                portFees: Number(document.getElementById('s-c-port-fees').value) || 0,
                others: Number(document.getElementById('s-c-others').value) || 0,
                loanInterest: Number(document.getElementById('s-c-loan-interest').value) || 0,
                loanInterestExternal: Number(document.getElementById('s-c-loan-interest-external').value) || 0,
                dockingIntermediate: Number(document.getElementById('s-c-docking-int').value) || 0,
                dockingPeriodic: Number(document.getElementById('s-c-docking-per').value) || 0,
                registryAnnual: Number(document.getElementById('s-c-registry-ann').value) || 0,
                depreciation: Number(document.getElementById('s-c-depreciation').value) || 0,
                hullInsurance: Number(document.getElementById('s-c-hull-insurance').value) || 0,
                largeRepair: Number(document.getElementById('s-c-large-repair').value) || 0
            }
        };
        AppData.addShipment(s);
        this.closeModal('ship-modal');
        if (this.currentView === 'debts') {
            this.navigate('debts', this.currentDebtTab || 'customer');
        } else {
            this.navigate('shipments');
        }
    },
    editShipment(id) {
        try {
            const s = AppData.state.shipments.find(x => x.id === id);
            if(!s) return;
            document.getElementById('ship-modal-content').innerHTML = Views.shipModal();
            document.getElementById('s-id').value = s.id;
            document.getElementById('s-contract-no').value = s.contractNo || '';
            document.getElementById('s-voy-no').value = s.voyageNo;
            document.getElementById('s-vessel-id').value = s.vesselId;
            document.getElementById('s-customer').value = s.customer || '';
            document.getElementById('s-cargo').value = s.cargo;
            document.getElementById('s-p-load').value = s.portLoad || '';
            document.getElementById('s-p-dis').value = s.portDischarge || '';
            document.getElementById('s-start').value = s.dateStart;
            document.getElementById('s-end').value = s.dateEnd;
            document.getElementById('s-report-month').value = s.reportMonth || '';
            document.getElementById('s-qty').value = s.qty;
            document.getElementById('s-rate').value = s.rate;
            document.getElementById('s-markup').value = s.markup;
            const savedRate = s.commissionRate !== undefined ? s.commissionRate : ((s.contractNo === 'HD25' || s.contractNo === 'HD54' || (s.customer || '').toLowerCase().includes('bình minh') || (s.customer || '').toLowerCase().includes('thái bình dương')) ? 20 : 28);
            document.getElementById('s-commission-rate').value = savedRate;
            document.getElementById('s-fuel-p').value = s.fuelPrice;
            
            const costs = s.costs || {};
            document.getElementById('s-c-hours').value = s.fuelHours || 0;
            document.getElementById('s-c-fuel').value = costs.fuelDO || 0;
            const loInput = document.getElementById('s-c-fuel-lo');
            if (loInput) {
                loInput.value = costs.fuelLO || 0;
                loInput.dataset.isOverridden = 'true';
            }
            document.getElementById('s-c-sal').value = costs.crewSalary || 0;
            document.getElementById('s-c-food').value = costs.crewFood || 0;
            document.getElementById('s-c-ins').value = costs.crewInsurance || 0;
            document.getElementById('s-c-m-mat-company').value = costs.materialCompany || 0;
            document.getElementById('s-c-m-mat-vessel').value = costs.materialVessel || 0;
            document.getElementById('s-c-m-other').value = costs.monthlyOther || 0;
            document.getElementById('s-c-agent').value = costs.agent || 0;
            document.getElementById('s-c-vessel-2ends').value = costs.vessel2ends || 0;
            document.getElementById('s-c-brokerage').value = costs.brokerage || 0;
            document.getElementById('s-c-vat').value = costs.vat || 0;
            document.getElementById('s-c-port-fees').value = costs.portFees || 0;
            document.getElementById('s-c-others').value = costs.others || 0;
            document.getElementById('s-c-docking-int').value = costs.dockingIntermediate || 0;
            document.getElementById('s-c-docking-per').value = costs.dockingPeriodic || 0;
            document.getElementById('s-c-registry-ann').value = costs.registryAnnual || 0;
            document.getElementById('s-c-depreciation').value = costs.depreciation || 0;
            document.getElementById('s-c-hull-insurance').value = costs.hullInsurance || 0;
            document.getElementById('s-c-large-repair').value = costs.largeRepair || 0;
            document.getElementById('s-c-loan-interest').value = costs.loanInterest || 0;
            document.getElementById('s-c-loan-interest-external').value = costs.loanInterestExternal || 0;

            this.calcShipmentFinance();

            // Initialize autocompletes
            this.initAutocomplete('s-customer', AppData.getCustomers().map(c => c.name));
            this.initAutocomplete('s-cargo', AppData.getCargos());
            this.initAutocomplete('s-p-load', AppData.getPorts(), () => this.calcBrokerage());
            this.initAutocomplete('s-p-dis', AppData.getPorts(), () => this.calcBrokerage());

            this.openModal('ship-modal');
        } catch (e) {
            console.error("Lỗi trong editShipment:", e);
            alert("Lỗi sửa chuyến hàng:\n" + e.message + "\n\nStack: " + e.stack);
        }
    },
    deleteShipment(id) {
        if (confirm('Bạn có chắc muốn xóa chuyến hàng này?')) {
            AppData.deleteShipment(id);
            if (this.currentView === 'debts') {
                this.navigate('debts', this.currentDebtTab || 'customer');
            } else {
                this.navigate('shipments');
            }
        }
    },
    openShipmentReport(id) {
        const s = AppData.state.shipments.find(x => x.id === id);
        if(!s) return;
        document.getElementById('report-content').innerHTML = Views.report(s);
        this.openModal('report-modal');
    },

    printAllCustomersDebtReport() {
        const debtsData = AppData.getCustomerDebts();
        const customers = debtsData.list;
        const vessels = AppData.getVessels();
        const vesselMap = {};
        vessels.forEach(v => {
            vesselMap[v.id] = v.name;
        });

        const normalizeName = (name) => {
            if (!name) return 'KHÁC';
            return name.trim().toUpperCase().replace(/\s+/g, ' ');
        };

        const matchCustomer = (t, custName) => {
            if (!t.partner) return false;
            return normalizeName(t.partner) === custName;
        };

        let grandTotalRevCompleted = 0;
        let grandTotalPaid = 0;
        let grandTotalDebtCompleted = 0;
        let grandTotalIncomplete = 0;
        let grandTotalDebt = 0;

        const rows = customers.map((c, idx) => {
            const shipments = AppData.getShipments().filter(s => normalizeName(s.customer) === c.name);
            const transactions = AppData.getTransactions().filter(t => matchCustomer(t, c.name));

            const sortedShipments = [...shipments].sort((a, b) => {
                const dateA = a.dateStart || '';
                const dateB = b.dateStart || '';
                if (dateA !== dateB) return dateA.localeCompare(dateB);
                return (a.contractNo || '').localeCompare(b.contractNo || '', undefined, {numeric: true, sensitivity: 'base'});
            });

            // Explicit payments/refunds mapped to shipments
            const explicitPaidMap = {};
            sortedShipments.forEach(s => {
                explicitPaidMap[s.id] = 0;
            });
            let unallocatedPaid = 0;

            transactions.forEach(t => {
                if (t.category === 'CVC') {
                    const matchedShipment = sortedShipments.find(s => s.contractNo && s.contractNo === t.contractNo);
                    if (matchedShipment) {
                        explicitPaidMap[matchedShipment.id] = (explicitPaidMap[matchedShipment.id] || 0) + (Number(t.thu) || 0);
                    } else {
                        unallocatedPaid += (Number(t.thu) || 0);
                    }
                }
            });

            const openingDebt = c.openingDebt;
            let remainingPaid = unallocatedPaid;
            let openingDebtRemaining = 0;

            if (remainingPaid >= openingDebt) {
                remainingPaid -= openingDebt;
                openingDebtRemaining = 0;
            } else {
                openingDebtRemaining = openingDebt - remainingPaid;
                remainingPaid = 0;
            }

            const contractDebts = [];
            if (openingDebtRemaining > 0) {
                contractDebts.push({ contractNo: 'Nợ đầu kỳ', debt: openingDebtRemaining });
            }

            sortedShipments.forEach((s, sIdx) => {
                const hasContract = s.contractNo && s.contractNo.trim() !== '';
                if (!hasContract) return;

                let invoiceAmt = Number(s.revenueInvoice) || 0;
                let explicitPaid = explicitPaidMap[s.id] || 0;
                let paidForThis = explicitPaid;
                
                if (remainingPaid > 0) {
                    if (sIdx === sortedShipments.length - 1) {
                        paidForThis += remainingPaid;
                        remainingPaid = 0;
                    } else if (invoiceAmt > paidForThis) {
                        let gap = invoiceAmt - paidForThis;
                        let add = Math.min(remainingPaid, gap);
                        paidForThis += add;
                        remainingPaid -= add;
                    }
                }
                let remainingDebt = Math.max(0, Math.round(invoiceAmt - paidForThis));
                if (remainingDebt > 0) {
                    const rawName = vesselMap[s.vesselId] || s.vesselId;
                    const vName = rawName.replace(/Vũ\s*Gia|VU\s*GIA/gi, 'VG').replace(/\s+/g, '').trim();
                    contractDebts.push({
                        contractNo: s.contractNo,
                        vesselName: vName,
                        voyageNo: s.voyageNo,
                        debt: remainingDebt
                    });
                }
            });

            const totalInvoiceRevenueCompleted = c.totalInvoiceRevenueCompleted;
            const totalPaid = c.totalPaid;
            const totalInvoiceRevenueIncomplete = c.totalInvoiceRevenueIncomplete;
            const totalDebt = c.invoiceDebt;
            const totalDebtCompleted = c.invoiceDebtCompleted || 0;

            grandTotalRevCompleted += totalInvoiceRevenueCompleted;
            grandTotalPaid += totalPaid;
            grandTotalDebtCompleted += totalDebtCompleted;
            grandTotalIncomplete += totalInvoiceRevenueIncomplete;
            grandTotalDebt += totalDebt;

            let contractDebtsHtml = '<em>Không có nợ HĐ</em>';
            if (contractDebts.length > 0) {
                contractDebtsHtml = contractDebts.map(cd => {
                    if (cd.contractNo === 'Nợ đầu kỳ') {
                        return `<div style="margin-bottom: 2px;">• Nợ đầu kỳ: <strong>${AppData.formatCurrency(cd.debt)}</strong></div>`;
                    }
                    return `<div style="margin-bottom: 2px;">• ${cd.contractNo} (Tàu ${cd.vesselName || ''} C.${cd.voyageNo || ''}): <strong>${AppData.formatCurrency(cd.debt)}</strong></div>`;
                }).join('');
            }

            const incompleteDebts = [];
            sortedShipments.forEach(s => {
                const hasContract = s.contractNo && s.contractNo.trim() !== '';
                if (!hasContract) {
                    const amt = Number(s.revenueInvoice) || 0;
                    if (amt > 0) {
                        const rawName = vesselMap[s.vesselId] || s.vesselId;
                        const vName = rawName.replace(/Vũ\s*Gia|VU\s*GIA/gi, 'VG').replace(/\s+/g, '').trim();
                        incompleteDebts.push({
                            vesselName: vName,
                            voyageNo: s.voyageNo,
                            amount: amt
                        });
                    }
                }
            });

            let incompleteDebtsHtml = AppData.formatCurrency(totalInvoiceRevenueIncomplete);
            let incompleteAlign = 'right';
            if (incompleteDebts.length > 0) {
                incompleteAlign = 'left';
                incompleteDebtsHtml = incompleteDebts.map(cd => {
                    return `<div style="margin-bottom: 2px;">• Tàu ${cd.vesselName || ''} C.${cd.voyageNo || ''}: <strong>${AppData.formatCurrency(cd.amount)}</strong></div>`;
                }).join('');
            }

            return `
                <tr style="border: 1px solid #000;">
                    <td style="border: 1px solid #000; padding: 8px; text-align: center; vertical-align: top;">${idx + 1}</td>
                    <td style="border: 1px solid #000; padding: 8px; vertical-align: top;"><strong>${c.name}</strong></td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: right; vertical-align: top; color: #1d4ed8;">${AppData.formatCurrency(totalInvoiceRevenueCompleted)}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: right; vertical-align: top; color: #15803d;">${AppData.formatCurrency(totalPaid)}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: left; vertical-align: top; font-size: 0.9rem; line-height: 1.4;">${contractDebtsHtml}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: ${incompleteAlign}; vertical-align: top; color: #b45309; font-size: 0.9rem; line-height: 1.4;">${incompleteDebtsHtml}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: right; vertical-align: top; font-weight: bold; color: #b91c1c;">${AppData.formatCurrency(totalDebt)}</td>
                </tr>
            `;
        }).join('');

        const summaryRow = `
            <tr style="background: #e2e8f0; font-weight: bold; border: 1px solid #000;">
                <td colspan="2" style="border: 1px solid #000; padding: 8px; text-align: center;">TỔNG CỘNG KHÁCH HÀNG</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #1d4ed8;">${AppData.formatCurrency(grandTotalRevCompleted)}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #15803d;">${AppData.formatCurrency(grandTotalPaid)}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #b91c1c;">${AppData.formatCurrency(grandTotalDebtCompleted)}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #b45309;">${AppData.formatCurrency(grandTotalIncomplete)}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #b91c1c;">${AppData.formatCurrency(grandTotalDebt)}</td>
            </tr>
        `;

        // Supplier Debts Calculation
        const supplierDebts = AppData.getSupplierDebts();
        const sortedSuppliers = [...supplierDebts].sort((a, b) => b.debt - a.debt);

        let grandSupplierPurchased = 0;
        let grandSupplierPaid = 0;
        let grandSupplierDebt = 0;

        const supplierRows = sortedSuppliers.map((s, idx) => {
            grandSupplierPurchased += s.totalPurchased;
            grandSupplierPaid += s.totalPaid;
            grandSupplierDebt += s.debt;

            return `
                <tr style="border: 1px solid #000;">
                    <td style="border: 1px solid #000; padding: 8px; text-align: center; vertical-align: top;">${idx + 1}</td>
                    <td style="border: 1px solid #000; padding: 8px; vertical-align: top;"><strong>${s.name}</strong></td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: right; vertical-align: top; color: #1d4ed8;">${AppData.formatCurrency(s.totalPurchased)}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: right; vertical-align: top; color: #15803d;">${AppData.formatCurrency(s.totalPaid)}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: right; vertical-align: top; font-weight: bold; color: #b91c1c;">${AppData.formatCurrency(s.debt)}</td>
                </tr>
            `;
        }).join('');

        const supplierSummaryRow = `
            <tr style="background: #e2e8f0; font-weight: bold; border: 1px solid #000;">
                <td colspan="2" style="border: 1px solid #000; padding: 8px; text-align: center;">TỔNG CỘNG NHÀ CUNG CẤP</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #1d4ed8;">${AppData.formatCurrency(grandSupplierPurchased)}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #15803d;">${AppData.formatCurrency(grandSupplierPaid)}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right; color: #b91c1c;">${AppData.formatCurrency(grandSupplierDebt)}</td>
            </tr>
        `;

        const html = `
            <div class="print-container" style="color: #000000 !important; background: #ffffff !important; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <style>
                    /* Force high-contrast black text for screen and print inside print-container */
                    .print-container {
                        color: #000000 !important;
                    }
                    .print-container h2 {
                        color: #000000 !important;
                    }
                    .print-container p {
                        color: #333333 !important;
                    }
                    .print-container th {
                        color: #000000 !important;
                    }
                    .print-container td {
                        color: #000000; /* Fallback */
                    }
                    .print-container td div {
                        color: #000000 !important;
                    }
                    .print-container td strong {
                        color: #000000 !important;
                    }
                    .print-container td em {
                        color: #666666 !important;
                    }
                    .print-footer-section,
                    .print-footer-section div {
                        color: #000000 !important;
                    }
                    @media print {
                        @page {
                            size: A4 landscape;
                            margin: 1cm 1.5cm;
                        }
                        body {
                            background: #fff !important;
                            color: #000 !important;
                        }
                        .print-container {
                            width: 100% !important;
                            max-width: 100% !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            box-shadow: none !important;
                            background: #fff !important;
                            color: #000 !important;
                        }
                    }
                </style>
                <div class="print-actions no-print" style="margin-bottom: 1.5rem; text-align: right; display: flex; gap: 10px; justify-content: flex-end; align-items: center;">
                    <button class="btn" onclick="app.closeModal('report-modal')" style="background-color: #ef4444 !important; color: #ffffff !important; border: none !important; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem; line-height: 1;"><i class="fa-solid fa-xmark"></i> Đóng Báo Cáo</button>
                    <button class="btn" onclick="app.shareReport()" style="background-color: #3b82f6 !important; color: #ffffff !important; border: none !important; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem; line-height: 1;"><i class="fa-solid fa-share-nodes"></i> Chia Sẻ Báo Cáo (Zalo/Copy)</button>
                    <button class="btn" onclick="app.exportReportAsImage()" style="background-color: #0ea5e9 !important; color: #ffffff !important; border: none !important; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem; line-height: 1;"><i class="fa-solid fa-file-image"></i> Tải Ảnh Báo Cáo</button>
                    <button class="btn" onclick="app.printDebtReport()" style="background-color: #10b981 !important; color: #ffffff !important; border: none !important; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem; line-height: 1;"><i class="fa-solid fa-print"></i> In Báo Cáo / Xuất PDF</button>
                </div>
                <div class="print-header" style="text-align: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700; text-transform: uppercase; color: #000000 !important;">BÁO CÁO TỔNG HỢP CÔNG NỢ KHÁCH HÀNG & NHÀ CUNG CẤP</h2>
                    <p style="margin: 4px 0; font-size: 0.9rem; color: #333333 !important;">Chi tiết công nợ vận chuyển của khách hàng và công nợ nhiên liệu của nhà cung cấp dầu</p>
                </div>
                
                <h3 style="font-size: 1.1rem; font-weight: bold; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #000000 !important; border-left: 4px solid #2563eb; padding-left: 8px; text-align: left;">I. CÔNG NỢ KHÁCH HÀNG (VẬN CHUYỂN)</h3>
                <table class="report-print-table" style="width: 100%; border-collapse: collapse; margin-top: 0.5rem; border: 1px solid #000; font-size: 0.9rem; color: #000;">
                    <thead>
                        <tr style="background: #cbd5e1; font-weight: bold; border: 1px solid #000;">
                            <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 40px;">STT</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: left; min-width: 150px;">Đối Tác / Khách Hàng</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: right; width: 150px;">Doanh Thu đã HT (VNĐ)</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: right; width: 140px;">Tổng Đã Thu (VNĐ)</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: left; width: 380px;">Dư Nợ Còn Lại theo HĐ</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: left; width: 280px;">Doanh Thu Dở Dang (VNĐ)</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: right; width: 150px;">Tổng Công Nợ (VNĐ)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                        ${summaryRow}
                    </tbody>
                </table>

                <h3 style="font-size: 1.1rem; font-weight: bold; margin-top: 2rem; margin-bottom: 0.5rem; color: #000000 !important; border-left: 4px solid #10b981; padding-left: 8px; text-align: left;">II. CÔNG NỢ NHÀ CUNG CẤP (NHIÊN LIỆU DẦU)</h3>
                <table class="report-print-table" style="width: 100%; border-collapse: collapse; margin-top: 0.5rem; border: 1px solid #000; font-size: 0.9rem; color: #000;">
                    <thead>
                        <tr style="background: #cbd5e1; font-weight: bold; border: 1px solid #000;">
                            <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 40px;">STT</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: left;">Nhà Cung Cấp Nhiên Liệu</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: right; width: 220px;">Tổng Tiền Mua Dầu (VNĐ)</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: right; width: 220px;">Đã Thanh Toán (VNĐ)</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: right; width: 220px;">Còn Nợ (VNĐ)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${supplierRows}
                        ${supplierSummaryRow}
                    </tbody>
                </table>
                
                <div class="print-footer-section" style="margin-top: 3rem; display: flex; justify-content: space-between; font-size: 0.9rem; color: #000000 !important;">
                    <div>
                        Người Lập Biểu
                        <div style="margin-top: 4rem; font-weight: bold;">(Ký, ghi rõ họ tên)</div>
                    </div>
                    <div style="text-align: right;">
                        Ngày xuất báo cáo: ${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}
                        <div style="margin-top: 4.5rem; font-weight: bold; font-style: italic; color: #666;">Hệ thống quản lý đội tàu ShipManage</div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('report-content').innerHTML = html;
        const modalEl = document.querySelector('#report-modal .modal');
        if (modalEl) {
            modalEl.style.maxWidth = '1300px';
            modalEl.style.width = '95%';
        }
        this.openModal('report-modal');
    },

    prepareClonedElementForCapture(clonedDoc, clonedEl, captureWidth) {
        try {
            // Remove all elements with class 'no-print'
            clonedDoc.querySelectorAll('.no-print').forEach(el => el.remove());
            
            // Set dimensions
            clonedEl.style.width = captureWidth + 'px';
            clonedEl.style.minWidth = captureWidth + 'px';
            clonedEl.style.maxWidth = 'none';
            clonedEl.style.overflow = 'visible';
            clonedEl.style.padding = '2rem';
            
            // Set a temporary ID on clonedEl if it doesn't have one
            if (!clonedEl.id) {
                clonedEl.id = 'cloned-capture-container-' + Date.now();
            }
            const containerId = clonedEl.id;
            
            // Force tables inside the container to be wide enough
            clonedEl.querySelectorAll('table').forEach(t => {
                t.style.width = '100%';
                t.style.minWidth = '1300px';
            });
            
            // Inject a style block to force light theme styling and high contrast text inside the clone
            const styleTag = clonedDoc.createElement('style');
            styleTag.innerHTML = 
                '#' + containerId + ' {\n' +
                '    background-color: #ffffff !important;\n' +
                '    background: #ffffff !important;\n' +
                '    color: #0b0f19 !important;\n' +
                '}\n' +
                '#' + containerId + ', #' + containerId + ' * {\n' +
                '    --text-main: #0b0f19 !important;\n' +
                '    --text-muted: #4b5563 !important;\n' +
                '    --border-color: #cbd5e1 !important;\n' +
                '    --secondary: #059669 !important;\n' +
                '    --accent: #dc2626 !important;\n' +
                '    --info: #0284c7 !important;\n' +
                '}\n' +
                '#' + containerId + ' h1, ' +
                '#' + containerId + ' h2, ' +
                '#' + containerId + ' h3, ' +
                '#' + containerId + ' h4, ' +
                '#' + containerId + ' h5, ' +
                '#' + containerId + ' h6, ' +
                '#' + containerId + ' p, ' +
                '#' + containerId + ' div, ' +
                '#' + containerId + ' span, ' +
                '#' + containerId + ' label {\n' +
                '    color: #0b0f19 !important;\n' +
                '}\n' +
                '#' + containerId + ' .text-success, ' +
                '#' + containerId + ' td.text-success, ' +
                '#' + containerId + ' [style*="color: var(--secondary)"], ' +
                '#' + containerId + ' td[style*="var(--secondary)"], ' +
                '#' + containerId + ' span[style*="var(--secondary)"] {\n' +
                '    color: #059669 !important;\n' +
                '}\n' +
                '#' + containerId + ' .text-danger, ' +
                '#' + containerId + ' td.text-danger, ' +
                '#' + containerId + ' [style*="color: var(--accent)"], ' +
                '#' + containerId + ' td[style*="var(--accent)"], ' +
                '#' + containerId + ' span[style*="var(--accent)"] {\n' +
                '    color: #dc2626 !important;\n' +
                '}\n' +
                '#' + containerId + ' .text-info, ' +
                '#' + containerId + ' td.text-info, ' +
                '#' + containerId + ' [style*="color: var(--info)"], ' +
                '#' + containerId + ' td[style*="var(--info)"], ' +
                '#' + containerId + ' span[style*="var(--info)"] {\n' +
                '    color: #0284c7 !important;\n' +
                '}\n' +
                '#' + containerId + ' [style*="color: var(--primary-light)"], ' +
                '#' + containerId + ' td[style*="var(--primary-light)"], ' +
                '#' + containerId + ' span[style*="var(--primary-light)"] {\n' +
                '    color: #0369a1 !important;\n' +
                '}\n' +
                '#' + containerId + ' table {\n' +
                '    border-color: #cbd5e1 !important;\n' +
                '    background-color: #ffffff !important;\n' +
                '}\n' +
                '#' + containerId + ' th {\n' +
                '    background-color: #1e293b !important;\n' +
                '    color: #f8fafc !important;\n' +
                '    border: 1px solid #cbd5e1 !important;\n' +
                '}\n' +
                '#' + containerId + ' td {\n' +
                '    color: #0b0f19 !important;\n' +
                '    border: 1px solid #cbd5e1 !important;\n' +
                '    background-color: transparent !important;\n' +
                '}\n' +
                '#' + containerId + ' .glass-card, ' +
                '#' + containerId + ' .stat-card {\n' +
                '    background-color: #f8fafc !important;\n' +
                '    background: #f8fafc !important;\n' +
                '    border: 1px solid #e2e8f0 !important;\n' +
                '    color: #0b0f19 !important;\n' +
                '    box-shadow: none !important;\n' +
                '}\n';
            clonedDoc.head.appendChild(styleTag);
        } catch (err) {
            console.error('Error styling cloned element for image capture:', err);
        }
    },

    initAutocomplete(inputId, options, onSelect) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        // Remove standard "list" attribute to prevent browser's buggy native datalist from showing up
        input.removeAttribute('list');
        input.setAttribute('autocomplete', 'off');
        
        // Remove existing autocomplete dropdown if any
        let dropdown = input.parentNode.querySelector('.custom-autocomplete-dropdown');
        if (dropdown) dropdown.remove();
        
        // Ensure parent has position relative
        input.parentNode.style.position = 'relative';
        
        // Create dropdown element
        dropdown = document.createElement('div');
        dropdown.className = 'custom-autocomplete-dropdown';
        dropdown.style.cssText = `
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 220px;
            overflow-y: auto;
            background: var(--bg-surface, #1e293b);
            border: 1px solid var(--border-color, #334155);
            border-radius: var(--radius-md, 6px);
            z-index: 9999;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15);
            margin-top: 4px;
        `;
        
        input.parentNode.appendChild(dropdown);
        
        const renderOptions = (filterText) => {
            const query = (filterText || '').trim().toLowerCase();
            const filtered = options.filter(opt => {
                if (!opt) return false;
                return opt.toLowerCase().includes(query);
            });
            
            if (filtered.length === 0) {
                dropdown.style.display = 'none';
                return;
            }
            
            dropdown.innerHTML = filtered.map(opt => `
                <div class="autocomplete-item" data-value="${opt}" style="
                    padding: 8px 12px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    color: var(--text-main, #f8fafc);
                    transition: background 0.15s;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
                " onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                    ${opt}
                </div>
            `).join('');
            
            dropdown.style.display = 'block';
            
            // Add click event for each item
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault(); 
                    const val = item.getAttribute('data-value');
                    input.value = val;
                    dropdown.style.display = 'none';
                    if (onSelect) onSelect(val);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                });
            });
        };
        
        input.addEventListener('input', () => {
            renderOptions(input.value);
        });
        
        input.addEventListener('focus', () => {
            renderOptions(input.value);
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => {
                dropdown.style.display = 'none';
            }, 150);
        });
        
        const clickOutsideHandler = (e) => {
            if (e.target !== input && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        };
        document.addEventListener('click', clickOutsideHandler);
        input._clickOutsideHandler = clickOutsideHandler;
    },

    exportReportAsImage() {
        if (typeof html2canvas === 'undefined') {
            alert('Thư viện xuất ảnh chưa được tải xong. Vui lòng thử lại sau vài giây.');
            return;
        }

        const container = document.querySelector('#report-modal .print-container');
        if (!container) {
            alert('Không tìm thấy nội dung báo cáo để xuất ảnh!');
            return;
        }

        const btn = document.querySelector('button[onclick="app.exportReportAsImage()"]');
        const originalText = btn ? btn.innerHTML : 'Tải Ảnh Báo Cáo';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo ảnh...';
        }

        // Use onclone to manipulate the internal clone that html2canvas uses.
        // windowWidth=1500 forces all CSS media-queries to compute at 1500px
        // (bypasses the mobile viewport of ~390px) so no columns are clipped.
        const CAPTURE_WIDTH = 1500;

        html2canvas(container, {
            scale:           2,
            useCORS:         true,
            backgroundColor: '#ffffff',
            width:           CAPTURE_WIDTH,
            windowWidth:     CAPTURE_WIDTH,
            onclone: (clonedDoc, clonedEl) => {
                this.prepareClonedElementForCapture(clonedDoc, clonedEl, CAPTURE_WIDTH);
            }
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'Bao_cao_tong_hop_cong_no.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
        }).catch(err => {
            console.error('Error generating image:', err);
            alert('Đã xảy ra lỗi khi tạo file ảnh báo cáo: ' + err.message);
            if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
        });
    },

    shareReport() {
        if (typeof html2canvas === 'undefined') {
            alert('Thư viện xuất ảnh chưa được tải xong. Vui lòng thử lại sau vài giây.');
            return;
        }

        const container = document.querySelector('#report-modal .print-container');
        if (!container) {
            alert('Không tìm thấy nội dung báo cáo để chia sẻ!');
            return;
        }

        const btn = document.querySelector('button[onclick="app.shareReport()"]');
        const originalText = btn ? btn.innerHTML : 'Chia sẻ Báo cáo';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo ảnh...';
        }

        const CAPTURE_WIDTH = 1500;

        html2canvas(container, {
            scale:           2,
            useCORS:         true,
            backgroundColor: '#ffffff',
            width:           CAPTURE_WIDTH,
            windowWidth:     CAPTURE_WIDTH,
            onclone: (clonedDoc, clonedEl) => {
                this.prepareClonedElementForCapture(clonedDoc, clonedEl, CAPTURE_WIDTH);
            }
        }).then(canvas => {
            canvas.toBlob(blob => {
                if (!blob) {
                    alert('Lỗi tạo ảnh báo cáo!');
                    if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
                    return;
                }

                const file = new File([blob], 'bao-cao-cong-no.png', { type: 'image/png' });
                
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    navigator.share({
                        files: [file],
                        title: 'Báo cáo công nợ',
                        text: 'Chia sẻ báo cáo tổng hợp công nợ khách hàng và nhà cung cấp'
                    }).then(() => {
                        if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
                    }).catch(err => {
                        console.error('Lỗi chia sẻ:', err);
                        this.copyImageToClipboard(blob, btn, originalText);
                    });
                } else {
                    this.copyImageToClipboard(blob, btn, originalText);
                }
            }, 'image/png');
        }).catch(err => {
            console.error('Error generating image for share:', err);
            alert('Đã xảy ra lỗi khi tạo file ảnh: ' + err.message);
            if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
        });
    },

    copyImageToClipboard(blob, btn, originalText) {
        if (navigator.clipboard && navigator.clipboard.write) {
            navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]).then(() => {
                alert('Đã sao chép ảnh báo cáo vào bộ nhớ tạm!\nBạn hãy mở Zalo, Messenger hoặc bất kỳ ứng dụng nào và nhấn Ctrl+V (hoặc chạm giữ -> Dán) để gửi ngay.');
                if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
            }).catch(err => {
                console.error('Lỗi sao chép vào clipboard:', err);
                alert('Không thể tự động sao chép ảnh báo cáo. Bạn hãy dùng chức năng "Tải Ảnh Báo Cáo" rồi gửi qua Zalo.');
                if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
            });
        } else {
            alert('Trình duyệt không hỗ trợ sao chép ảnh tự động. Bạn hãy dùng chức năng "Tải Ảnh Báo Cáo" rồi gửi qua Zalo.');
            if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
        }
    },

    handleImageShareOrDownload(canvas, imageName, btn, originalText, actionType) {
        if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
        
        // Detect mobile browsers
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
            
        if (isMobile) {
            // Mobile: display generated image in modal for touch-and-hold saving/sharing
            const imgData = canvas.toDataURL('image/png');
            const modalImg = document.getElementById('mobile-share-img');
            const shareModal = document.getElementById('mobile-share-modal');
            if (modalImg && shareModal) {
                modalImg.src = imgData;
                this.openModal('mobile-share-modal');
            } else {
                // Fallback
                alert('Vui lòng chạm giữ vào ảnh ở trang tiếp theo để lưu/chia sẻ.');
                const newWin = window.open();
                if (newWin) {
                    newWin.document.write(`<body style="margin:0; background:#000; display:flex; align-items:center; justify-content:center;"><img src="${imgData}" style="max-width:100%; max-height:100%; object-fit:contain;" /></body>`);
                }
            }
        } else {
            // PC:
            if (actionType === 'share') {
                // Copy to clipboard
                canvas.toBlob(blob => {
                    if (blob) {
                        this.copyImageToClipboard(blob, btn, originalText);
                    } else {
                        alert('Lỗi tạo ảnh báo cáo!');
                    }
                }, 'image/png');
            } else {
                // Download file
                try {
                    const link = document.createElement('a');
                    link.download = imageName || 'Bao_cao.png';
                    link.href = canvas.toDataURL('image/png');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } catch (err) {
                    console.error("Direct download failed, attempting copy to clipboard", err);
                    canvas.toBlob(blob => {
                        if (blob) {
                            this.copyImageToClipboard(blob, btn, originalText);
                        }
                    }, 'image/png');
                }
            }
        }
    },

    shareInlineReport(elementId, shareTitle) {
        if (typeof html2canvas === 'undefined') {
            alert('Thư viện xuất ảnh chưa được tải xong. Vui lòng thử lại sau vài giây.');
            return;
        }

        const container = document.getElementById(elementId);
        if (!container) {
            alert('Không tìm thấy nội dung báo cáo để chia sẻ!');
            return;
        }

        const btn = document.querySelector(`button[onclick*="${elementId}"]`);
        const originalText = btn ? btn.innerHTML : 'Gửi Zalo / MXH';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo ảnh...';
        }

        const CAPTURE_WIDTH = 1500;

        html2canvas(container, {
            scale:           2,
            useCORS:         true,
            backgroundColor: '#ffffff',
            width:           CAPTURE_WIDTH,
            windowWidth:     CAPTURE_WIDTH,
            onclone: (clonedDoc, clonedEl) => {
                this.prepareClonedElementForCapture(clonedDoc, clonedEl, CAPTURE_WIDTH);
            }
        }).then(canvas => {
            const escapedElementId = elementId.replace(/'/g, "");
            this.handleImageShareOrDownload(canvas, `${escapedElementId}.png`, btn, originalText, 'share');
        }).catch(err => {
            console.error('Error generating image for share:', err);
            alert('Đã xảy ra lỗi khi tạo file ảnh: ' + err.message);
            if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
        });
    },

    exportInlineReportAsImage(elementId, imageName) {
        if (typeof html2canvas === 'undefined') {
            alert('Thư viện xuất ảnh chưa được tải xong. Vui lòng thử lại sau vài giây.');
            return;
        }

        const container = document.getElementById(elementId);
        if (!container) {
            alert('Không tìm thấy nội dung báo cáo để xuất ảnh!');
            return;
        }

        const btn = document.querySelector(`button[onclick*="${elementId}"]`);
        const originalText = btn ? btn.innerHTML : 'Tải Ảnh';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo ảnh...';
        }

        const CAPTURE_WIDTH = 1500;

        html2canvas(container, {
            scale:           2,
            useCORS:         true,
            backgroundColor: '#ffffff',
            width:           CAPTURE_WIDTH,
            windowWidth:     CAPTURE_WIDTH,
            onclone: (clonedDoc, clonedEl) => {
                this.prepareClonedElementForCapture(clonedDoc, clonedEl, CAPTURE_WIDTH);
            }
        }).then(canvas => {
            this.handleImageShareOrDownload(canvas, imageName || `${elementId}.png`, btn, originalText, 'download');
        }).catch(err => {
            console.error('Error generating image:', err);
            alert('Đã xảy ra lỗi khi tạo file ảnh báo cáo: ' + err.message);
            if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
        });
    },

    generateMasterReport(action) {
        const startMonth = document.getElementById('master-report-month-from')?.value || this.lastSelectedMasterMonthFrom;
        const endMonth = document.getElementById('master-report-month-to')?.value || this.lastSelectedMasterMonthTo;
        if (!startMonth || !endMonth) {
            alert('Vui lòng chọn thời gian bắt đầu và kết thúc!');
            return;
        }

        const html = Views.compileMasterReportHTML(startMonth, endMonth);
        document.getElementById('report-content').innerHTML = html;

        if (action === 'print') {
            const container = document.getElementById('report-content');
            if (!container) return;

            // Set report modal width styles for master report layout
            const modalEl = document.querySelector('#report-modal .modal');
            if (modalEl) {
                modalEl.style.maxWidth = '1300px';
                modalEl.style.width = '95%';
            }

            // Open the modal
            this.openModal('report-modal');

            // Wait brief paint period, run print, then close modal
            setTimeout(() => {
                window.print();
                this.closeModal('report-modal');
            }, 300);
        } else if (action === 'image') {
            const container = document.getElementById('report-content');
            if (!container) return;

            const btn = document.getElementById('btn-master-image');
            const originalText = btn ? btn.innerHTML : 'Tải Ảnh';
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo ảnh...';
            }

            const CAPTURE_WIDTH = 1500;
            html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: CAPTURE_WIDTH,
                windowWidth: CAPTURE_WIDTH,
                onclone: (clonedDoc, clonedEl) => {
                    this.prepareClonedElementForCapture(clonedDoc, clonedEl, CAPTURE_WIDTH);
                }
            }).then(canvas => {
                this.handleImageShareOrDownload(canvas, `Bao_cao_tong_hop_${startMonth}_den_${endMonth}.png`, btn, originalText, 'download');
            }).catch(err => {
                console.error('Error generating image:', err);
                alert('Đã xảy ra lỗi khi tạo file ảnh báo cáo: ' + err.message);
                if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
            });
        } else if (action === 'share') {
            const container = document.getElementById('report-content');
            if (!container) return;

            const btn = document.getElementById('btn-master-share');
            const originalText = btn ? btn.innerHTML : 'Gửi Zalo / MXH';
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo ảnh...';
            }

            const CAPTURE_WIDTH = 1500;
            html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: CAPTURE_WIDTH,
                windowWidth: CAPTURE_WIDTH,
                onclone: (clonedDoc, clonedEl) => {
                    this.prepareClonedElementForCapture(clonedDoc, clonedEl, CAPTURE_WIDTH);
                }
            }).then(canvas => {
                this.handleImageShareOrDownload(canvas, `Bao_cao_tong_hop_${startMonth}_den_${endMonth}.png`, btn, originalText, 'share');
            }).catch(err => {
                console.error('Error generating image:', err);
                alert('Đã xảy ra lỗi khi tạo file ảnh báo cáo: ' + err.message);
                if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
            });
        }
    },

    // Open a dedicated print window for landscape PDF - mobile browsers ignore
    // @page{size:landscape} inside window.print(), but a new window with its
    // own <style> block is respected reliably on both Android and iOS.
    printDebtReport() {
        window.print();
    },

    updateHeaderCompanyInfo() {
        const headerInfoEl = document.getElementById('header-company-info');
        if (!headerInfoEl) return;
        const c = AppData.getCompany() || {};
        headerInfoEl.innerHTML = `
            <div class="company-name" title="${c.name || ''}">${c.name || 'CÔNG TY CHƯA CẬP NHẬT'}</div>
            <div class="company-address" title="Địa chỉ">
                <i class="fa-solid fa-location-dot"></i> ${c.address || 'Chưa có địa chỉ'}
            </div>
            <div class="company-meta">
                <span class="detail-item" title="Mã số thuế"><i class="fa-solid fa-receipt"></i> MST: ${c.taxId || 'Chưa có MST'}</span>
                <span class="detail-divider">|</span>
                <span class="detail-item" title="Thông tin ngân hàng"><i class="fa-solid fa-credit-card"></i> ${c.bankInfo || 'Chưa có thông tin ngân hàng'}</span>
            </div>
        `;
    },

    // Company Actions
    saveCompany() {
        const data = {
            name: document.getElementById('c-name').value,
            address: document.getElementById('c-addr').value,
            taxId: document.getElementById('c-tax').value,
            bankInfo: document.getElementById('c-bank').value,
            openingBalances: {
                'ABbank': Number(document.getElementById('bal-abbank').value) || 0,
                'Viettinbank': Number(document.getElementById('bal-viettin').value) || 0,
                'Tài khoản cá nhân': Number(document.getElementById('bal-ca-nhan').value) || 0,
                'Tiền mặt': Number(document.getElementById('bal-tien-mat').value) || 0
            }
        };
        AppData.updateCompany(data);
        alert('Đã cập nhật thông tin Master Data và Số dư đầu kỳ!');
        this.navigate('company');
    },

    importTransactionsExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (rows.length < 3) {
                    alert('File không hợp lệ hoặc không có dữ liệu!');
                    return;
                }
                
                const headers = rows[2];
                const dataRows = rows.slice(3);
                
                const colIdx = (name) => headers.indexOf(name);
                
                const idIdx = colIdx('ID Giao Dịch');
                const dateIdx = colIdx('Ngày');
                const vesselIdx = colIdx('Tàu / Bộ Phận');
                const categoryIdx = colIdx('Hạng Mục');
                const voyageNoIdx = colIdx('Chuyến Số');
                const contractNoIdx = colIdx('Số Hợp Đồng');
                const partnerIdx = colIdx('Đối Tác');
                const contentIdx = colIdx('Nội Dung');
                const thuIdx = colIdx('Thu Vào (VNĐ)');
                const chiIdx = colIdx('Chi Ra (VNĐ)');
                const accountIdx = colIdx('Tài Khoản');
                
                if (dateIdx === -1 || categoryIdx === -1 || contentIdx === -1) {
                    alert('File Excel không đúng định dạng báo cáo giao dịch thu chi!');
                    return;
                }

                let count = 0;
                const affectedAllocations = new Set();
                
                dataRows.forEach(row => {
                    if (row.length === 0 || !row[dateIdx]) return;
                    
                    const id = row[idIdx] ? String(row[idIdx]).trim() : ('TR' + Date.now() + Math.random().toString().slice(2, 6));
                    
                    // Parse Excel Date safely
                    let dateVal = row[dateIdx];
                    let dateStr = '';
                    if (dateVal) {
                        if (typeof dateVal === 'number') {
                            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                            const dateObj = new Date(excelEpoch.getTime() + dateVal * 24 * 60 * 60 * 1000);
                            dateStr = dateObj.toISOString().slice(0, 10);
                        } else {
                            const str = String(dateVal).trim();
                            if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                dateStr = str;
                            } else if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                                const parts = str.split('/');
                                const d = parts[0].padStart(2, '0');
                                const m = parts[1].padStart(2, '0');
                                const y = parts[2];
                                dateStr = `${y}-${m}-${d}`;
                            } else {
                                const parsed = new Date(str);
                                if (!isNaN(parsed.getTime())) {
                                    dateStr = parsed.toISOString().slice(0, 10);
                                } else {
                                    dateStr = str;
                                }
                            }
                        }
                    }

                    const t = {
                        id,
                        date: dateStr,
                        vessel: String(row[vesselIdx] || 'VP').trim(),
                        category: String(row[categoryIdx] || '').trim(),
                        voyageNo: row[voyageNoIdx] ? String(row[voyageNoIdx]).trim() : '',
                        contractNo: row[contractNoIdx] ? String(row[contractNoIdx]).trim() : '',
                        partner: String(row[partnerIdx] || '').trim(),
                        content: String(row[contentIdx] || '').trim(),
                        thu: Number(row[thuIdx]) || 0,
                        chi: Number(row[chiIdx]) || 0,
                        account: String(row[accountIdx] || 'Tiền mặt').trim()
                    };
                    
                    const existingIdx = AppData.state.transactions.findIndex(x => x.id === id);
                    const oldTx = existingIdx >= 0 ? { ...AppData.state.transactions[existingIdx] } : null;
                    
                    if (existingIdx >= 0) {
                        AppData.state.transactions[existingIdx] = t;
                    } else {
                        AppData.state.transactions.push(t);
                    }
                    
                    if (t.vessel && t.vessel !== 'VP' && t.date && (t.category === '9.Vật Tư' || t.category === '6.Lãi Vay')) {
                        affectedAllocations.add(`${t.vessel}_${t.date.substring(0, 7)}`);
                    }
                    if (oldTx && oldTx.vessel && oldTx.vessel !== 'VP' && oldTx.date && (oldTx.category === '9.Vật Tư' || oldTx.category === '6.Lãi Vay')) {
                        affectedAllocations.add(`${oldTx.vessel}_${oldTx.date.substring(0, 7)}`);
                    }
                    count++;
                });
                
                affectedAllocations.forEach(key => {
                    const [vesselId, monthStr] = key.split('_');
                    AppData.recalculateVesselAllocations(vesselId, monthStr);
                });
                
                AppData.save();
                alert(`Khôi phục thành công ${count} giao dịch!`);
                this.navigate('company');
            } catch (err) {
                console.error(err);
                alert('Lỗi khi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    importShipmentsExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (rows.length < 3) {
                    alert('File không hợp lệ hoặc không có dữ liệu!');
                    return;
                }
                
                const headers = rows[2];
                const dataRows = rows.slice(3);
                
                const colIdx = (name) => headers.indexOf(name);
                
                const idIdx = colIdx('ID Chuyến Hàng');
                const contractNoIdx = colIdx('Số Hợp Đồng');
                const voyageNoIdx = colIdx('Chuyến Số');
                const vesselIdIdx = colIdx('Mã Tàu');
                const customerIdx = colIdx('Khách Hàng');
                const cargoIdx = colIdx('Tên Hàng');
                const portLoadIdx = colIdx('Cảng Xếp (Đi)');
                const portDischargeIdx = colIdx('Cảng Dỡ (Đến)');
                const dateStartIdx = colIdx('Ngày Xếp Hàng');
                const dateEndIdx = colIdx('Ngày Dỡ Hàng');
                const reportMonthIdx = colIdx('Tháng Hạch Toán');
                const qtyIdx = colIdx('Khối Lượng (Tấn)');
                const rateIdx = colIdx('Đơn Giá Thực (VNĐ)');
                const markupIdx = colIdx('Tiền Gửi (VND/tấn)');
                const fuelPriceIdx = colIdx('Giá Dầu Chuyến (VNĐ)');
                const fuelHoursIdx = colIdx('Số Giờ Chạy (Giờ)');
                const revenueRealIdx = colIdx('Doanh Thu Thực Tế (VNĐ)');
                const revenueInvoiceIdx = colIdx('Doanh Thu Hóa Đơn (VNĐ)');
                const refundIdx = colIdx('Tiền Gửi Lại Khách (VNĐ)');
                
                const costsMap = {
                    fuelDO: colIdx('Tiền Dầu DO (VNĐ)'),
                    fuelLO: colIdx('Tiền Dầu LO (VNĐ)'),
                    crewSalary: colIdx('Lương TV (VNĐ)'),
                    crewFood: colIdx('Tiền Ăn (VNĐ)'),
                    crewInsurance: colIdx('Bảo Hiểm (VNĐ)'),
                    materialCompany: colIdx('Vật Tư Cty Cấp (VNĐ)'),
                    materialVessel: colIdx('Vật Tư Tàu Chi (VNĐ)'),
                    monthlyOther: colIdx('CP Khác Cty Cấp (VNĐ)'),
                    agent: colIdx('Đại Lý 2 Đầu Cảng (VNĐ)'),
                    vessel2ends: colIdx('Tàu Chi 2 Đầu Cảng (VNĐ)'),
                    brokerage: colIdx('Tiền Bông (VNĐ)'),
                    vat: colIdx('Thuế VAT (VNĐ)'),
                    portFees: colIdx('Hoa Tiêu, Tàu Lai, Phí Cảng (VNĐ)'),
                    others: colIdx('Chi Phí Khác Tàu Chi (VNĐ)'),
                    loanInterest: colIdx('Lãi Vay Ngân Hàng (VNĐ)') !== -1 ? colIdx('Lãi Vay Ngân Hàng (VNĐ)') : colIdx('Lãi Vay (VNĐ)'),
                    loanInterestExternal: colIdx('Lãi Vay Ngoài (VNĐ)'),
                    dockingIntermediate: colIdx('Lên Đà Trung Gian (VNĐ)'),
                    dockingPeriodic: colIdx('Lên Đà Định Kỳ (VNĐ)'),
                    registryAnnual: colIdx('Đăng Kiểm Hàng Năm (VNĐ)'),
                    depreciation: colIdx('Khấu Hao (VNĐ)'),
                    hullInsurance: colIdx('Bảo Hiểm Thân Vỏ (VNĐ)')
                };

                let count = 0;
                dataRows.forEach(row => {
                    if (row.length === 0 || !row[contractNoIdx]) return;
                    
                    const id = row[idIdx] || ('S' + Date.now() + Math.random().toString().slice(2, 6));
                    const s = {
                        id,
                        contractNo: String(row[contractNoIdx] || '').trim(),
                        voyageNo: String(row[voyageNoIdx] || '').trim(),
                        vesselId: String(row[vesselIdIdx] || '').trim(),
                        customer: String(row[customerIdx] || '').trim(),
                        cargo: String(row[cargoIdx] || '').trim(),
                        portLoad: String(row[portLoadIdx] || '').trim(),
                        portDischarge: String(row[portDischargeIdx] || '').trim(),
                        dateStart: String(row[dateStartIdx] || '').trim(),
                        dateEnd: String(row[dateEndIdx] || '').trim(),
                        reportMonth: String(row[reportMonthIdx] || '').trim(),
                        qty: Number(row[qtyIdx]) || 0,
                        rate: Number(row[rateIdx]) || 0,
                        markup: Number(row[markupIdx]) || 0,
                        fuelPrice: Number(row[fuelPriceIdx]) || 0,
                        fuelHours: Number(row[fuelHoursIdx]) || 0,
                        revenueReal: Number(row[revenueRealIdx]) || 0,
                        revenueInvoice: Number(row[revenueInvoiceIdx]) || 0,
                        refundAmount: Number(row[refundIdx]) || 0,
                        costs: {}
                    };
                    
                    for (let key in costsMap) {
                        const idx = costsMap[key];
                        s.costs[key] = idx !== -1 ? (Number(row[idx]) || 0) : 0;
                    }
                    
                    const existingIdx = AppData.state.shipments.findIndex(x => x.id === id);
                    if (existingIdx >= 0) {
                        AppData.state.shipments[existingIdx] = s;
                    } else {
                        AppData.state.shipments.push(s);
                    }
                    count++;
                });
                
                AppData.save();
                alert(`Khôi phục thành công ${count} chuyến hàng!`);
                this.navigate('company');
            } catch (err) {
                console.error(err);
                alert('Lỗi khi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    importFuelExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                let voyagesCount = 0;
                let logsCount = 0;
                
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (rows.length < 3) return;
                    
                    const headers = rows[2];
                    const dataRows = rows.slice(3);
                    
                    const colIdx = (name) => headers.indexOf(name);
                    
                    const voyIdIdx = colIdx('ID Chuyến Dầu');
                    const logIdIdx = colIdx('ID Chặng Hành Trình');
                    const vesselIdIdx = colIdx('Mã Tàu');
                    const voyageNoIdx = colIdx('Chuyến Dầu Số');
                    const cargoTypeIdx = colIdx('Mặt Hàng');
                    const initialFuelIdx = colIdx('Số Dư Đầu Kỳ (L)');
                    const addedFuelIdx = colIdx('Số Lượng Cấp (L)');
                    const fuelDateIdx = colIdx('Ngày Cấp');
                    const fuelLocationIdx = colIdx('Nơi Cấp Dầu');
                    const fuelVendorIdx = colIdx('Nhà Cung Cấp Dầu');
                    const fuelUnitPriceIdx = colIdx('Đơn Giá Dầu (VNĐ)');
                    
                    const startPosIdx = colIdx('Nơi Đi');
                    const startTimeIdx = colIdx('Thời Gian Đi');
                    const endPosIdx = colIdx('Nơi Đến');
                    const endTimeIdx = colIdx('Thời Gian Đến');
                    const fuelRateIdx = colIdx('Định Mức Tiêu Thụ (L/h)');
                    const hoursIdx = colIdx('Số Giờ Chạy (Giờ)');
                    
                    let lastVoyageId = '';
                    let lastVesselId = sheetName;
                    
                    dataRows.forEach(row => {
                        if (row.length === 0) return;
                        
                        if (row[voyIdIdx]) {
                            lastVoyageId = String(row[voyIdIdx]).trim();
                            lastVesselId = String(row[vesselIdIdx] || lastVesselId).trim();
                            
                            const voy = {
                                id: lastVoyageId,
                                vesselId: lastVesselId,
                                voyageNo: String(row[voyageNoIdx] || '').trim(),
                                cargoType: String(row[cargoTypeIdx] || '').trim(),
                                initialFuel: Number(row[initialFuelIdx]) || 0,
                                addedFuel: Number(row[addedFuelIdx]) || 0,
                                fuelDate: String(row[fuelDateIdx] || '').trim(),
                                fuelVendor: String(row[fuelVendorIdx] || '').trim(),
                                fuelLocation: String(row[fuelLocationIdx] || '').trim(),
                                fuelUnitPrice: Number(row[fuelUnitPriceIdx]) || 0
                            };
                            
                            const existingIdx = AppData.state.fuelVoyages.findIndex(x => x.id === voy.id);
                            if (existingIdx >= 0) {
                                AppData.state.fuelVoyages[existingIdx] = voy;
                            } else {
                                AppData.state.fuelVoyages.push(voy);
                            }
                            voyagesCount++;
                        }
                        
                        if (row[logIdIdx] && lastVoyageId) {
                            const logId = String(row[logIdIdx]).trim();
                            
                            const parseDt = (str) => {
                                if (!str) return '';
                                const parts = str.split(', ');
                                if (parts.length === 2) {
                                    const [datePart, timePart] = parts;
                                    const [d, m, y] = datePart.split('/');
                                    return `${y}-${m}-${d}T${timePart}`;
                                }
                                const dateObj = new Date(str);
                                return isNaN(dateObj.getTime()) ? str : dateObj.toISOString();
                            };
                            
                            const log = {
                                id: logId,
                                fuelVoyageId: lastVoyageId,
                                startTime: parseDt(row[startTimeIdx]),
                                startPos: String(row[startPosIdx] || '').trim(),
                                endTime: parseDt(row[endTimeIdx]),
                                endPos: String(row[endPosIdx] || '').trim(),
                                fuelRate: Number(row[fuelRateIdx]) || 0,
                                hours: Number(row[hoursIdx]) || 0
                            };
                            
                            const existingIdx = AppData.state.fuelLogs.findIndex(x => x.id === log.id);
                            if (existingIdx >= 0) {
                                AppData.state.fuelLogs[existingIdx] = log;
                            } else {
                                AppData.state.fuelLogs.push(log);
                            }
                            logsCount++;
                        }
                    });
                });
                
                AppData.save();
                alert(`Khôi phục thành công ${voyagesCount} chuyến dầu và ${logsCount} chặng hành trình!`);
                this.navigate('company');
            } catch (err) {
                console.error(err);
                alert('Lỗi khi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },
    importVesselExpensesExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const parseExcelDate = (val) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                        const dateObj = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
                        return dateObj.toISOString().slice(0, 10);
                    }
                    const str = String(val).trim();
                    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
                    if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                        const parts = str.split('/');
                        const d = parts[0].padStart(2, '0');
                        const m = parts[1].padStart(2, '0');
                        const y = parts[2];
                        return `${y}-${m}-${d}`;
                    }
                    const parsed = new Date(str);
                    return isNaN(parsed.getTime()) ? str : parsed.toISOString().slice(0, 10);
                };

                const wsCap = workbook.Sheets['Quản lý chi phí tàu'] || workbook.Sheets['Theo dõi tài chính tàu chi'];
                if (!wsCap) {
                    return alert('Không tìm thấy sheet "Quản lý chi phí tàu" hoặc "Theo dõi tài chính tàu chi" trong file Excel!');
                }

                const rows = XLSX.utils.sheet_to_json(wsCap, { header: 1 });
                if (rows.length < 3) return alert('File Excel không đúng định dạng!');

                const headers = rows[2];
                const dataRows = rows.slice(3);
                const colIdx = (name) => headers.indexOf(name);
                
                const hasNewFormat = colIdx('Mã Báo Cáo') !== -1;
                let restoredCount = 0;

                if (hasNewFormat) {
                    const idIdx = colIdx('Mã Báo Cáo');
                    const vesselIdx = colIdx('Mã Tàu');
                    const monthIdx = colIdx('Tháng');
                    const foodIdx = colIdx('Tiền Ăn (VNĐ)');
                    const materialIdx = colIdx('Vật Tư Tàu Chi (VNĐ)');
                    const portNameIdx = colIdx('Tên Khoản Mục Cảng');
                    const portVoyageIdx = colIdx('Chuyến Cảng');
                    const portAmountIdx = colIdx('Số Tiền Cảng (VNĐ)');
                    const brokVoyageIdx = colIdx('Chuyến Tiền Bông');
                    const brokAmountIdx = colIdx('Số Tiền Bông (VNĐ)');
                    
                    let currentReport = null;
                    const reportsMap = {};
                    
                    dataRows.forEach(row => {
                        if (row.length === 0) return;
                        if (row[idIdx]) {
                            const id = String(row[idIdx]).trim();
                            currentReport = {
                                id,
                                vesselId: String(row[vesselIdx] || '').trim(),
                                month: String(row[monthIdx] || '').trim(),
                                food: Number(row[foodIdx]) || 0,
                                material: Number(row[materialIdx]) || 0,
                                portExpenses: [],
                                brokerages: []
                            };
                            reportsMap[id] = currentReport;
                        }
                        
                        if (currentReport) {
                            const portName = row[portNameIdx] ? String(row[portNameIdx]).trim() : '';
                            const portAmount = Number(row[portAmountIdx]) || 0;
                            const portVoyage = row[portVoyageIdx] ? String(row[portVoyageIdx]).trim() : '';
                            if (portName || portAmount > 0) {
                                currentReport.portExpenses.push({
                                    port: portName,
                                    amount: portAmount,
                                    voyageNo: portVoyage
                                });
                            }
                            
                            const brokVoyage = row[brokVoyageIdx] ? String(row[brokVoyageIdx]).trim() : '';
                            const brokAmount = Number(row[brokAmountIdx]) || 0;
                            if (brokVoyage || brokAmount > 0) {
                                currentReport.brokerages.push({
                                    voyageNo: brokVoyage,
                                    amount: brokAmount
                                });
                            }
                        }
                    });
                    
                    if (!AppData.state.captainReports) AppData.state.captainReports = [];
                    Object.values(reportsMap).forEach(report => {
                        const existingIdx = AppData.state.captainReports.findIndex(x => x.id === report.id);
                        if (existingIdx >= 0) {
                            AppData.state.captainReports[existingIdx] = report;
                        } else {
                            AppData.state.captainReports.push(report);
                        }
                        AppData.recalculateVesselAllocations(report.vesselId, report.month);
                        restoredCount++;
                    });
                    AppData.save();
                    alert(`Khôi phục thành công ${restoredCount} Báo cáo Thuyền trưởng!`);
                } else {
                    const idIdx = colIdx('ID Chi Phí');
                    const dateIdx = colIdx('Ngày');
                    const vesselIdx = colIdx('Mã Tàu');
                    const voyageNoIdx = colIdx('Chuyến Số');
                    const categoryIdx = colIdx('Hạng Mục');
                    const amountIdx = colIdx('Số Tiền (VNĐ)');
                    const contentIdx = colIdx('Nội Dung');
                    
                    dataRows.forEach(row => {
                        if (row.length === 0 || !row[dateIdx]) return;
                        const id = row[idIdx] ? String(row[idIdx]).trim() : ('VE-' + Date.now() + Math.random().toString().slice(2, 6));
                        const dateStr = parseExcelDate(row[dateIdx]);
                        const ve = {
                            id,
                            date: dateStr,
                            vesselId: String(row[vesselIdx] || '').trim(),
                            voyageNo: String(row[voyageNoIdx] || '').trim(),
                            category: String(row[categoryIdx] || '').trim(),
                            amount: Number(row[amountIdx]) || 0,
                            content: String(row[contentIdx] || '').trim()
                        };
                        const existingIdx = AppData.state.vesselExpenses.findIndex(x => x.id === id);
                        if (existingIdx >= 0) AppData.state.vesselExpenses[existingIdx] = ve;
                        else AppData.state.vesselExpenses.push(ve);
                        restoredCount++;
                    });
                    AppData.save();
                    alert(`Khôi phục thành công ${restoredCount} Giao dịch Chi phí Tàu (Legacy)!`);
                }
                this.navigate('company');
            } catch (err) {
                console.error(err);
                alert('Lỗi khi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },
    editVessel(id) {
        const v = AppData.getVessel(id);
        if(!v) return;
        document.getElementById('vessel-modal-content').innerHTML = Views.vesselModal(id);
        this.openModal('vessel-modal');
    },
    saveVessel() {
        const id = document.getElementById('v-id').value;
        const data = {
            capacity: Number(document.getElementById('v-capacity').value) || 0,
            captain: document.getElementById('v-captain').value.trim(),
            captainPhone: document.getElementById('v-captain-phone').value.trim(),
            manager: document.getElementById('v-manager').value.trim(),
            managerPhone: document.getElementById('v-manager-phone').value.trim(),
            fuelRate: Number(document.getElementById('v-fuel-rate').value) || 0
        };
        AppData.updateVessel(id, data);
        this.closeModal('vessel-modal');
        this.navigate('company');
    },
    // Partner (NCC & Khach hang) Actions
    openPartnerModal(type, id = null) {
        let partner = null;
        if (id) {
            if (type === 'vendor') partner = AppData.state.vendors.find(x => x.id === id);
            else partner = AppData.state.customers.find(x => x.id === id);
        }
        document.getElementById('partner-modal-content').innerHTML = Views.partnerModal(type, partner);
        this.openModal('partner-modal');
        // Auto-focus the name input
        setTimeout(() => { const el = document.getElementById('p-name'); if(el) el.focus(); }, 100);
    },
    savePartner(type) {
        const id = document.getElementById('p-id').value;
        const partner = {
            id: id || null,
            name: document.getElementById('p-name').value.trim(),
            contact: document.getElementById('p-contact').value.trim(),
            address: document.getElementById('p-address').value.trim()
        };
        if (!partner.name) { alert('Vui long nhap ten doi tac!'); return; }
        if (type === 'vendor') {
            AppData.addVendor(partner);
            this.closeModal('partner-modal');
            this.navigate('partners', 'vendor');
        } else {
            AppData.addCustomer(partner);
            this.closeModal('partner-modal');
            this.navigate('partners', 'customer');
        }
    },
    deleteVendor(id) {
        if (confirm('Ban co chac muon xoa Nha Cung Cap nay?')) {
            AppData.deleteVendor(id);
            this.navigate('partners', 'vendor');
        }
    },
    editVendor(id) {
        this.openPartnerModal('vendor', id);
    },
    deleteCustomer(id) {
        if (confirm('Ban co chac muon xoa Khach Hang nay?')) {
            AppData.deleteCustomer(id);
            this.navigate('partners', 'customer');
        }
    },
    editCustomer(id) {
        this.openPartnerModal('customer', id);
    },

    // Vessel Expense Controllers - Captain's Monthly Report Form
    loadVesselExpenses() {
        const month = document.getElementById('ve-month').value;
        const vesselId = document.getElementById('ve-vessel').value;
        this.lastVesselExpensesMonth = month;
        this.lastVesselExpensesVesselId = vesselId;
        const stats = AppData.getVesselFundStats(vesselId, month);

        // Update Stats Cards
        document.getElementById('ve-stat-opening').innerText = AppData.formatCurrency(stats.opening);
        document.getElementById('ve-stat-income').innerText = AppData.formatCurrency(stats.income);
        document.getElementById('ve-stat-expense').innerText = AppData.formatCurrency(stats.expense);
        document.getElementById('ve-stat-balance').innerText = AppData.formatCurrency(stats.balance);

        // Fetch existing Captain Report
        const report = AppData.getCaptainReport(vesselId, month) || {
            food: 0,
            material: 0,
            portExpenses: [],
            brokerages: [],
            foodDetails: [],
            materialDetails: [],
            portDetails: []
        };

        // Set static fields (temporarily set, calculations will overwrite them)
        document.getElementById('ve-food').value = report.food !== undefined ? report.food : '';
        document.getElementById('ve-material').value = report.material !== undefined ? report.material : '';

        // Generate dynamic rows for Food Details
        const foodBody = document.getElementById('ve-food-details-body');
        if (foodBody) {
            foodBody.innerHTML = '';
            if (report.foodDetails && report.foodDetails.length > 0) {
                report.foodDetails.forEach(fd => {
                    this.addFoodDetailRow(fd.description, fd.amount);
                });
            } else if (Number(report.food) > 0) {
                this.addFoodDetailRow('Tiền ăn tháng (kết chuyển)', report.food);
            } else {
                this.addFoodDetailRow();
            }
        }

        // Generate dynamic rows for Material Details
        const materialBody = document.getElementById('ve-material-details-body');
        if (materialBody) {
            materialBody.innerHTML = '';
            if (report.materialDetails && report.materialDetails.length > 0) {
                report.materialDetails.forEach(md => {
                    this.addMaterialDetailRow(md.description, md.amount);
                });
            } else if (Number(report.material) > 0) {
                this.addMaterialDetailRow('Tiền vật tư (kết chuyển)', report.material);
            } else {
                this.addMaterialDetailRow();
            }
        }

        // Generate dynamic groups for Port Details
        const portGroupsContainer = document.getElementById('ve-port-groups-container');
        if (portGroupsContainer) {
            portGroupsContainer.innerHTML = '';
            
            let itemsToLoad = [];
            if (report.portDetails && report.portDetails.length > 0) {
                itemsToLoad = report.portDetails;
            } else if (report.portExpenses && report.portExpenses.length > 0) {
                itemsToLoad = report.portExpenses.map(pe => ({
                    port: pe.port,
                    voyageNo: pe.voyageNo,
                    description: 'Chi phí cảng (kết chuyển)',
                    amount: pe.amount
                }));
            }

            if (itemsToLoad.length > 0) {
                // Group flat port items by (portName + voyageNo)
                const groupsMap = {};
                itemsToLoad.forEach(item => {
                    const key = `${item.port || ''}||${item.voyageNo || ''}`;
                    if (!groupsMap[key]) {
                        groupsMap[key] = {
                            port: item.port || '',
                            voyageNo: item.voyageNo || '',
                            rows: []
                        };
                    }
                    groupsMap[key].rows.push({
                        description: item.description || '',
                        amount: item.amount || ''
                    });
                });

                Object.values(groupsMap).forEach(g => {
                    const groupDiv = this.addPortDetailGroup(g.port, g.voyageNo);
                    g.rows.forEach(r => {
                        this.addPortDetailGroupRow(groupDiv, r.description, r.amount);
                    });
                });
            } else {
                // Add one default empty group with one empty row
                this.addPortDetailGroup('', '', true);
            }
        }

        // Generate dynamic rows for Brokerages
        const brokerageContainer = document.getElementById('ve-brokerages-container');
        if (brokerageContainer) {
            brokerageContainer.innerHTML = '';
            if (report.brokerages && report.brokerages.length > 0) {
                report.brokerages.forEach(b => {
                    this.addBrokerageRow(b.voyageNo, b.amount);
                });
            }
        }

        // Run calculations once to align totals
        this.calcFoodDetailsTotal();
        this.calcMaterialDetailsTotal();
        this.syncPortDetailsToLeft();

        // Update dynamic allocated voyages list
        this.renderAllocatedVoyages(vesselId, month);
    },

    getVoyageOptionsHtml(vesselId, selectedVoyageNo = '') {
        const shipments = AppData.getShipments().filter(s => s.vesselId === vesselId);
        const fuelVoyages = AppData.getFuelVoyages(vesselId) || [];

        // Collect all unique voyage numbers
        const uniqueVoyages = new Map(); // voyageNo -> cargo

        // Add from shipments first (since we prefer shipments' cargo description)
        shipments.forEach(s => {
            if (s.voyageNo) {
                uniqueVoyages.set(s.voyageNo, s.cargo || '');
            }
        });

        // Add from fuel voyages
        fuelVoyages.forEach(fv => {
            if (fv.voyageNo && !uniqueVoyages.has(fv.voyageNo)) {
                uniqueVoyages.set(fv.voyageNo, fv.cargoType || '');
            } else if (fv.voyageNo && !uniqueVoyages.get(fv.voyageNo)) {
                // If it exists but has no cargo, update it with cargoType if available
                uniqueVoyages.set(fv.voyageNo, fv.cargoType || '');
            }
        });

        // Convert Map to array of { voyageNo, cargo }
        const voyageList = Array.from(uniqueVoyages.entries()).map(([voyageNo, cargo]) => ({
            voyageNo,
            cargo
        }));

        // Sort descending (newest first, i.e., C16, C15, ...)
        voyageList.sort((a, b) => {
            const getNum = s => {
                if (!s || !s.voyageNo) return 0;
                const match = s.voyageNo.match(/\d+/);
                return match ? parseInt(match[0], 10) : 0;
            };
            const numA = getNum(a);
            const numB = getNum(b);
            return numB - numA;
        });

        let html = '<option value="">-- Chọn chuyến --</option>';
        html += voyageList.map(v => {
            const label = v.cargo ? `Chuyến ${v.voyageNo} (${v.cargo})` : `Chuyến ${v.voyageNo}`;
            return `<option value="${v.voyageNo}" ${v.voyageNo === selectedVoyageNo ? 'selected' : ''}>${label}</option>`;
        }).join('');
        return html;
    },

    // Detail Row Generators & Event Handlers
    addFoodDetailRow(description = '', amount = '') {
        const tbody = document.getElementById('ve-food-details-body');
        if (!tbody) return;

        const tr = document.createElement('tr');
        tr.className = 'food-detail-row';
        tr.innerHTML = `
            <td style="padding: 4px 6px !important; vertical-align: middle;"><input type="text" class="form-control food-desc" placeholder="Thịt, rau, gạo, bồi dưỡng..." value="${description}" style="font-size:0.8rem; padding:2px 6px; height: 26px; background: rgba(0,0,0,0.3);" oninput="app.calcFoodDetailsTotal()"></td>
            <td style="padding: 4px 6px !important; vertical-align: middle;"><input type="number" class="form-control food-amount" placeholder="Số tiền" value="${amount || ''}" style="font-size:0.8rem; padding:2px 6px; height: 26px; text-align:right; background: rgba(0,0,0,0.3);" oninput="app.calcFoodDetailsTotal()"></td>
            <td style="padding: 4px 6px !important; vertical-align: middle; text-align: center;"><button type="button" class="icon-btn" onclick="app.removeFoodDetailRow(this)" style="color:var(--rose-light); padding:0; line-height:1;"><i class="fa-solid fa-trash-can" style="font-size:0.85rem;"></i></button></td>
        `;
        tbody.appendChild(tr);
        this.calcFoodDetailsTotal();
    },

    removeFoodDetailRow(btn) {
        btn.closest('tr').remove();
        this.calcFoodDetailsTotal();
    },

    calcFoodDetailsTotal() {
        const rows = document.querySelectorAll('.food-detail-row');
        let total = 0;
        rows.forEach(r => {
            const val = r.querySelector('.food-amount').value;
            total += Number(val) || 0;
        });
        const totalIndicator = document.getElementById('ve-food-detail-total');
        if (totalIndicator) totalIndicator.innerText = AppData.formatCurrency(total);
        const mainInput = document.getElementById('ve-food');
        if (mainInput) mainInput.value = total || '';
    },

    addMaterialDetailRow(description = '', amount = '') {
        const tbody = document.getElementById('ve-material-details-body');
        if (!tbody) return;

        const tr = document.createElement('tr');
        tr.className = 'material-detail-row';
        tr.innerHTML = `
            <td style="padding: 4px 6px !important; vertical-align: middle;"><input type="text" class="form-control material-desc" placeholder="Sơn, dây, lọc dầu, nhớt..." value="${description}" style="font-size:0.8rem; padding:2px 6px; height: 26px; background: rgba(0,0,0,0.3);" oninput="app.calcMaterialDetailsTotal()"></td>
            <td style="padding: 4px 6px !important; vertical-align: middle;"><input type="number" class="form-control material-amount" placeholder="Số tiền" value="${amount || ''}" style="font-size:0.8rem; padding:2px 6px; height: 26px; text-align:right; background: rgba(0,0,0,0.3);" oninput="app.calcMaterialDetailsTotal()"></td>
            <td style="padding: 4px 6px !important; vertical-align: middle; text-align: center;"><button type="button" class="icon-btn" onclick="app.removeMaterialDetailRow(this)" style="color:var(--rose-light); padding:0; line-height:1;"><i class="fa-solid fa-trash-can" style="font-size:0.85rem;"></i></button></td>
        `;
        tbody.appendChild(tr);
        this.calcMaterialDetailsTotal();
    },

    removeMaterialDetailRow(btn) {
        btn.closest('tr').remove();
        this.calcMaterialDetailsTotal();
    },

    calcMaterialDetailsTotal() {
        const rows = document.querySelectorAll('.material-detail-row');
        let total = 0;
        rows.forEach(r => {
            const val = r.querySelector('.material-amount').value;
            total += Number(val) || 0;
        });
        const totalIndicator = document.getElementById('ve-material-detail-total');
        if (totalIndicator) totalIndicator.innerText = AppData.formatCurrency(total);
        const mainInput = document.getElementById('ve-material');
        if (mainInput) mainInput.value = total || '';
    },

    // Grouped Port Cost Handlers
    addPortDetailGroup(port = '', voyageNo = '', addBlankRow = false) {
        const container = document.getElementById('ve-port-groups-container');
        if (!container) return;

        const vesselId = document.getElementById('ve-vessel').value;
        const optionsHtml = this.getVoyageOptionsHtml(vesselId, voyageNo);

        const groupDiv = document.createElement('div');
        groupDiv.className = 'port-detail-group';
        groupDiv.style = 'background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); padding: 0.6rem; margin-bottom: 0.5rem;';
        groupDiv.innerHTML = `
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 0.5rem; flex-wrap: wrap;">
                <div style="flex: 2; display: flex; align-items: center; gap: 0.35rem; min-width: 140px;">
                    <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap;">Tên Cảng:</span>
                    <input type="text" class="form-control port-group-name" placeholder="Ví dụ: Cảng Vũng Tàu..." value="${port}" style="font-size:0.8rem; padding: 2px 6px; height: 26px; background: rgba(0,0,0,0.3);" oninput="app.syncPortDetailsToLeft()">
                </div>
                <div style="flex: 1.5; display: flex; align-items: center; gap: 0.35rem; min-width: 120px;">
                    <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap;">Chuyến:</span>
                    <select class="form-control port-group-voyage" style="font-size:0.8rem; padding: 2px 6px; height: 26px; background: rgba(0,0,0,0.3);" onchange="app.syncPortDetailsToLeft()">
                        ${optionsHtml}
                    </select>
                </div>
                <button type="button" class="icon-btn" onclick="app.removePortDetailGroup(this)" style="color:var(--rose-light); font-size: 0.85rem; padding:0; line-height:1;" title="Xóa cảng & chuyến này"><i class="fa-solid fa-trash-can"></i></button>
            </div>
            <div class="table-responsive" style="margin-bottom: 0.35rem;">
                <table class="table" style="background: transparent; font-size: 0.8rem; margin: 0;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <th style="padding: 4px 6px !important;">Nội dung chi tiết</th>
                            <th style="width: 160px; text-align: right; padding: 4px 6px !important;">Số tiền (VND)</th>
                            <th style="width: 45px; text-align: center; padding: 4px 6px !important;"></th>
                        </tr>
                    </thead>
                    <tbody class="port-group-rows-body">
                        <!-- Rows will go here -->
                    </tbody>
                </table>
            </div>
            <button type="button" class="btn btn-outline btn-xs" onclick="app.addPortDetailGroupRow(this)" style="font-size:0.7rem; padding: 2px 6px; border-color: rgba(255,255,255,0.1);"><i class="fa-solid fa-plus"></i> Thêm dòng chi phí</button>
        `;
        container.appendChild(groupDiv);

        if (addBlankRow) {
            this.addPortDetailGroupRow(groupDiv);
        }

        this.syncPortDetailsToLeft();

        // Scroll to the bottom of container automatically
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);

        return groupDiv;
    },

    removePortDetailGroup(btn) {
        btn.closest('.port-detail-group').remove();
        this.syncPortDetailsToLeft();
    },

    addPortDetailGroupRow(btnOrGroup, description = '', amount = '') {
        let tbody;
        if (btnOrGroup instanceof HTMLElement && btnOrGroup.classList.contains('port-detail-group')) {
            tbody = btnOrGroup.querySelector('.port-group-rows-body');
        } else {
            tbody = btnOrGroup.closest('.port-detail-group').querySelector('.port-group-rows-body');
        }
        if (!tbody) return;

        const tr = document.createElement('tr');
        tr.className = 'port-group-row-item';
        tr.innerHTML = `
            <td style="padding: 4px 6px !important; vertical-align: middle;"><input type="text" class="form-control port-item-desc" placeholder="Biên phòng, hoa tiêu, lai dắt, bồi dưỡng..." value="${description}" style="font-size:0.8rem; padding:2px 6px; height: 26px; background: rgba(0,0,0,0.3);" oninput="app.syncPortDetailsToLeft()"></td>
            <td style="padding: 4px 6px !important; vertical-align: middle;"><input type="number" class="form-control port-item-amount" placeholder="Số tiền" value="${amount || ''}" style="font-size:0.8rem; padding:2px 6px; height: 26px; text-align:right; background: rgba(0,0,0,0.3);" oninput="app.syncPortDetailsToLeft()"></td>
            <td style="padding: 4px 6px !important; vertical-align: middle; text-align: center;"><button type="button" class="icon-btn" onclick="app.removePortDetailGroupRow(this)" style="color:var(--rose-light); padding:0; line-height:1;"><i class="fa-solid fa-trash-can" style="font-size:0.85rem;"></i></button></td>
        `;
        tbody.appendChild(tr);
        this.syncPortDetailsToLeft();
    },

    removePortDetailGroupRow(btn) {
        btn.closest('.port-group-row-item').remove();
        this.syncPortDetailsToLeft();
    },

    syncPortDetailsToLeft() {
        const groups = document.querySelectorAll('.port-detail-group');
        let total = 0;
        
        // Group flat items by port name + voyageNo
        const aggregatedGroups = {};
        groups.forEach(g => {
            const port = g.querySelector('.port-group-name').value.trim();
            const voyage = g.querySelector('.port-group-voyage').value;
            
            const rows = g.querySelectorAll('.port-group-row-item');
            rows.forEach(r => {
                const amt = Number(r.querySelector('.port-item-amount').value) || 0;
                total += amt;

                if (port || amt > 0) {
                    const key = `${port}||${voyage}`;
                    if (!aggregatedGroups[key]) {
                        aggregatedGroups[key] = { port, voyage, amount: 0 };
                    }
                    aggregatedGroups[key].amount += amt;
                }
            });
        });

        // Update total port details indicator
        const portDetailTotal = document.getElementById('ve-port-detail-total');
        if (portDetailTotal) portDetailTotal.innerText = AppData.formatCurrency(total);

        // Regenerate #ve-ports-container on the left
        const container = document.getElementById('ve-ports-container');
        if (!container) return;
        container.innerHTML = '';

        const vesselId = document.getElementById('ve-vessel').value;

        Object.values(aggregatedGroups).forEach(g => {
            const optionsHtml = this.getVoyageOptionsHtml(vesselId, g.voyage);
            const row = document.createElement('div');
            row.className = 'port-expense-row';
            row.style = 'display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center;';
            row.innerHTML = `
                <input type="text" class="form-control port-name" placeholder="Tên cảng" value="${g.port}" readonly style="flex:2; font-size:0.85rem; padding:6px; background: rgba(255,255,255,0.05); color: var(--text-main); pointer-events: none;">
                <select class="form-control port-voyage" disabled style="flex:1.2; font-size:0.85rem; padding:6px; background: rgba(255,255,255,0.05); color: var(--text-main); pointer-events: none;">
                    ${optionsHtml}
                </select>
                <input type="number" class="form-control port-amount" placeholder="Số tiền" value="${g.amount}" readonly style="flex:1.5; font-size:0.85rem; padding:6px; text-align:right; background: rgba(255,255,255,0.05); color: var(--text-main); pointer-events: none;">
            `;
            container.appendChild(row);
        });
    },

    addBrokerageRow(voyageNo = '', amount = '') {
        const container = document.getElementById('ve-brokerages-container');
        const vesselId = document.getElementById('ve-vessel').value;
        const optionsHtml = this.getVoyageOptionsHtml(vesselId, voyageNo);

        const row = document.createElement('div');
        row.className = 'brokerage-row';
        row.style = 'display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center;';
        row.innerHTML = `
            <select class="form-control brokerage-voyage" style="flex:2; font-size:0.85rem; padding:6px; background: rgba(0,0,0,0.3);">
                ${optionsHtml}
            </select>
            <input type="number" class="form-control brokerage-amount" placeholder="Số tiền" value="${amount}" style="flex:2; font-size:0.85rem; padding:6px; text-align:right; background: rgba(0,0,0,0.3);">
            <button type="button" class="icon-btn" onclick="app.removeBrokerageRow(this)" style="color:var(--rose-light);"><i class="fa-solid fa-trash-can"></i></button>
        `;
        container.appendChild(row);
    },

    removeBrokerageRow(btn) {
        btn.closest('.brokerage-row').remove();
    },

    resetCaptainReportForm() {
        if (confirm('Bạn có chắc muốn xóa trống biểu mẫu nhập này?')) {
            document.getElementById('ve-food').value = '';
            document.getElementById('ve-material').value = '';
            document.getElementById('ve-ports-container').innerHTML = '';
            document.getElementById('ve-brokerages-container').innerHTML = '';

            // Clear detail bodies
            document.getElementById('ve-food-details-body').innerHTML = '';
            document.getElementById('ve-material-details-body').innerHTML = '';
            document.getElementById('ve-port-groups-container').innerHTML = '';

            // Add defaults
            this.addFoodDetailRow();
            this.addMaterialDetailRow();
            const groupDiv = this.addPortDetailGroup();
            this.addPortDetailGroupRow(groupDiv);
        }
    },

    saveMonthlyCaptainReport() {
        const vesselId = document.getElementById('ve-vessel').value;
        const month = document.getElementById('ve-month').value;
        this.lastVesselExpensesMonth = month;
        this.lastVesselExpensesVesselId = vesselId;

        // Collect Food Details
        const foodDetails = [];
        const foodRows = document.querySelectorAll('.food-detail-row');
        foodRows.forEach(r => {
            const description = r.querySelector('.food-desc').value.trim();
            const amount = Number(r.querySelector('.food-amount').value) || 0;
            if (description || amount > 0) {
                foodDetails.push({ description, amount });
            }
        });

        // Collect Material Details
        const materialDetails = [];
        const materialRows = document.querySelectorAll('.material-detail-row');
        materialRows.forEach(r => {
            const description = r.querySelector('.material-desc').value.trim();
            const amount = Number(r.querySelector('.material-amount').value) || 0;
            if (description || amount > 0) {
                materialDetails.push({ description, amount });
            }
        });

        // Collect Port Details
        const portDetails = [];
        const portGroups = document.querySelectorAll('.port-detail-group');
        let hasPortMissingVoyage = false;
        portGroups.forEach(g => {
            const port = g.querySelector('.port-group-name').value.trim();
            const voyageNo = g.querySelector('.port-group-voyage').value;

            const rows = g.querySelectorAll('.port-group-row-item');
            rows.forEach(r => {
                const description = r.querySelector('.port-item-desc').value.trim();
                const amount = Number(r.querySelector('.port-item-amount').value) || 0;

                if (port || description || amount > 0) {
                    if (!voyageNo) {
                        hasPortMissingVoyage = true;
                    }
                    portDetails.push({ port, voyageNo, description, amount });
                }
            });
        });

        if (hasPortMissingVoyage) {
            alert('Vui lòng chọn chuyến đi tương ứng cho các khoản Chi phí cảng trong bảng chi tiết!');
            return;
        }

        // Collect Port Expenses (from left side container summary)
        const portExpenses = [];
        const portRows = document.querySelectorAll('.port-expense-row');
        for (let row of portRows) {
            const port = row.querySelector('.port-name').value.trim();
            const voyageNo = row.querySelector('.port-voyage').value;
            const amountVal = row.querySelector('.port-amount').value;
            const amount = Number(amountVal) || 0;

            if (port || amount > 0) {
                portExpenses.push({ port, amount, voyageNo });
            }
        }

        // Collect Brokerages
        const brokerages = [];
        const brokerageRows = document.querySelectorAll('.brokerage-row');
        for (let row of brokerageRows) {
            const voyageNo = row.querySelector('.brokerage-voyage').value;
            const amountVal = row.querySelector('.brokerage-amount').value;
            const amount = Number(amountVal) || 0;

            if (voyageNo || amount > 0) {
                if (!voyageNo) {
                    alert('Vui lòng chọn chuyến đi cho các khoản Tiền Bông!');
                    return;
                }
                brokerages.push({ voyageNo, amount });
            }
        }

        // Create Report object
        const report = {
            id: `CR-${vesselId}-${month}`,
            vesselId,
            month,
            food: Number(document.getElementById('ve-food').value) || 0,
            material: Number(document.getElementById('ve-material').value) || 0,
            portExpenses,
            brokerages,
            foodDetails,
            materialDetails,
            portDetails
        };

        // Save and refresh
        AppData.saveCaptainReport(report);
        alert(`Đã cập nhật số liệu Báo cáo Thuyền trưởng tháng ${month.split('-').reverse().join('/')} cho tàu ${vesselId}!`);
        this.loadVesselExpenses();
    },

    renderAllocatedVoyages(vesselId, monthStr) {
        const tbody = document.getElementById('ve-allocated-voyages');
        if (!tbody) return;

        // Get shipments matching this vessel and month
        const shipments = AppData.getShipments().filter(s => {
            const sMonth = s.reportMonth || (s.dateStart && typeof s.dateStart === 'string' ? s.dateStart.substring(0, 7) : '');
            return s.vesselId === vesselId && sMonth === monthStr;
        });

        if (shipments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">Không có chuyến hàng nào hoạt động trong tháng này để nhận phân bổ.</td></tr>`;
            return;
        }

        tbody.innerHTML = shipments.map(s => {
            const food = s.costs.crewFood || 0;
            const matVessel = s.costs.materialVessel || 0;
            const port2ends = s.costs.vessel2ends || 0;
            const brokerage = s.costs.brokerage || 0;
            const total = food + matVessel + port2ends + brokerage;

            return `
                <tr class="hover-row">
                    <td><strong style="color: var(--secondary);">Chuyến ${s.voyageNo}</strong><br><small style="color:var(--text-muted);">${s.cargo}</small></td>
                    <td><small>${s.dateStart} → ${s.dateEnd}</small><br><small style="color:var(--info); font-weight:600;">${AppData.calcDays(s.dateStart, s.dateEnd)} ngày chạy</small></td>
                    <td style="text-align: right; font-weight: 500;">${AppData.formatCurrency(food)}</td>
                    <td style="text-align: right; font-weight: 500;">${AppData.formatCurrency(matVessel)}</td>
                    <td style="text-align: right; font-weight: 500; color:var(--info);">${AppData.formatCurrency(port2ends)}</td>
                    <td style="text-align: right; font-weight: 500; color:var(--warning);">${AppData.formatCurrency(brokerage)}</td>
                    <td style="text-align: right; font-weight: 700; color: var(--rose-light);">${AppData.formatCurrency(total)}</td>
                </tr>
            `;
        }).join('');
    },

    updateCustomerOpeningDebt(custName) {
        const input = document.getElementById('cust-opening-debt');
        if (!input) return;
        const amount = Number(input.value) || 0;

        if (!AppData.state.company.customerOpeningDebts) {
            AppData.state.company.customerOpeningDebts = {};
        }
        AppData.state.company.customerOpeningDebts[custName] = amount;
        
        AppData.save();
        
        alert(`Đã cập nhật công nợ đầu kỳ của khách hàng "${custName}" thành công!`);
        this.navigate('debts');
    },

    // =====================================================================
    // LOAN MANAGEMENT FUNCTIONS
    // =====================================================================

    openLoanModal(loanId = null) {
        let loan = null;
        if (loanId) {
            loan = (AppData.getLoans() || []).find(l => l.id === loanId) || null;
        }
        const content = document.getElementById('loan-modal-content');
        if (content) content.innerHTML = Views.loanModal(loan);
        this.openModal('loan-modal');
    },

    openLoanPaymentModal(loanId) {
        const loan = (AppData.getLoans() || []).find(l => l.id === loanId);
        if (!loan) return alert('Không tìm thấy hợp đồng vay!');
        const content = document.getElementById('loan-payment-modal-content');
        if (content) content.innerHTML = Views.loanPaymentModal(loan);
        this.openModal('loan-payment-modal');
    },

    openLoanHistoryModal(loanId) {
        const loan = (AppData.getLoans() || []).find(l => l.id === loanId);
        if (!loan) return alert('Không tìm thấy hợp đồng vay!');
        const content = document.getElementById('loan-history-modal-content');
        if (content) content.innerHTML = Views.loanHistoryModal(loan);
        this.openModal('loan-history-modal');
    },

    openLoanScheduleModal(loanId) {
        const loan = (AppData.getLoans() || []).find(l => l.id === loanId);
        if (!loan) return alert('Không tìm thấy hợp đồng vay!');
        const content = document.getElementById('loan-schedule-modal-content');
        if (content) content.innerHTML = Views.loanScheduleModal(loan);
        this.openModal('loan-schedule-modal');
    },

    saveLoan() {
        const id = document.getElementById('l-id').value.trim();
        const contractNo = document.getElementById('l-contractNo').value.trim();
        const lender = document.getElementById('l-lender').value.trim();
        const vesselId = document.getElementById('l-vesselId').value.trim();
        const type = document.getElementById('l-type').value.trim();
        const termYears = document.getElementById('l-termYears').value;
        const principalPeriod = document.getElementById('l-principalPeriod').value;
        const interestPeriod = document.getElementById('l-interestPeriod').value;
        const gracePeriodMonths = Number(document.getElementById('l-gracePeriodMonths').value) || 0;
        const fixedPrincipalAmountRaw = document.getElementById('l-fixedPrincipalAmount').value;
        const loanAmount = Number(document.getElementById('l-loanAmount').value) || 0;
        const interestRate = document.getElementById('l-interestRate').value.trim();
        const status = document.getElementById('l-status').value;
        const isPaidOff = document.getElementById('l-isPaidOff').checked;
        const interestChangeDate = document.getElementById('l-interestChangeDate').value;
        const changedInterestRate = document.getElementById('l-changedInterestRate').value.trim();
        const disbursementDate = document.getElementById('l-disbursementDate').value;
        const principalDueDate = document.getElementById('l-principalDueDate').value;
        const interestDueDate = document.getElementById('l-interestDueDate').value;
        const note = document.getElementById('l-note').value.trim();

        // Collect vessel allocations if MULTIPLE
        let vesselAllocations = {};
        if (vesselId === 'MULTIPLE') {
            document.querySelectorAll('.l-vessel-checkbox').forEach(chk => {
                if (chk.checked) {
                    const vId = chk.getAttribute('data-vessel-id');
                    const inp = document.getElementById(`l-alloc-${vId}`);
                    vesselAllocations[vId] = Number(inp ? inp.value : 0) || 0;
                }
            });
        }

        const existingLoans = AppData.getLoans() || [];
        const existingLoan = id ? existingLoans.find(l => l.id === id) : null;

        const loan = {
            id: id || ('L' + Date.now()),
            contractNo,
            lender,
            vesselId,
            type,
            termYears: termYears ? Number(termYears) : null,
            principalPeriod,
            interestPeriod,
            gracePeriodMonths,
            fixedPrincipalAmount: fixedPrincipalAmountRaw ? Number(fixedPrincipalAmountRaw) : null,
            loanAmount,
            interestRate,
            status: isPaidOff ? 'Đã tất toán' : status,
            isPaidOff,
            interestChangeDate: interestChangeDate || null,
            changedInterestRate: changedInterestRate || null,
            disbursementDate,
            principalDueDate,
            interestDueDate,
            note,
            vesselAllocations: vesselId === 'MULTIPLE' ? vesselAllocations : {},
            payments: existingLoan ? (existingLoan.payments || []) : []
        };

        AppData.addLoan(loan);
        AppData.save();
        this.closeModal('loan-modal');
        this.navigate('financials');
    },

    saveLoanPayment() {
        const loanId = document.getElementById('lp-loanId').value;
        const date = document.getElementById('lp-date').value;
        const type = document.getElementById('lp-type').value;
        const amount = Number(document.getElementById('lp-amount').value) || 0;
        const note = document.getElementById('lp-note') ? document.getElementById('lp-note').value.trim() : '';

        if (!loanId || !date || !amount) return alert('Vui lòng nhập đầy đủ thông tin thanh toán!');

        const loans = AppData.getLoans() || [];
        const loan = loans.find(l => l.id === loanId);
        if (!loan) return alert('Không tìm thấy hợp đồng!');

        if (!loan.payments) loan.payments = [];
        loan.payments.push({
            id: 'P' + Date.now(),
            date,
            type,
            amount,
            note
        });

        // Auto-update next due dates
        if (type === 'Gốc') {
            const newDate = this._advancePeriodDate(date, loan.principalPeriod || 'quarterly');
            loan.principalDueDate = newDate;
        } else {
            const newDate = this._advancePeriodDate(date, loan.interestPeriod || 'monthly');
            loan.interestDueDate = newDate;
        }

        AppData.addLoan(loan);
        AppData.save();
        this.closeModal('loan-payment-modal');
        this.navigate('financials');
    },

    deleteLoanPayment(loanId, paymentId) {
        if (!confirm('Bạn có chắc muốn xóa đợt thanh toán này?')) return;
        const loans = AppData.getLoans() || [];
        const loan = loans.find(l => l.id === loanId);
        if (!loan) return;
        loan.payments = (loan.payments || []).filter(p => p.id !== paymentId);
        AppData.addLoan(loan);
        AppData.save();
        this.openLoanHistoryModal(loanId);
    },

    deleteLoan(loanId) {
        if (!confirm('Bạn có chắc chắn muốn xóa hợp đồng vay này? Thao tác không thể hoàn tác!')) return;
        AppData.deleteLoan(loanId);
        AppData.save();
        this.navigate('financials');
    },

    onLoanVesselChange() {
        const sel = document.getElementById('l-vesselId');
        const container = document.getElementById('l-multiple-vessels-container');
        if (!sel || !container) return;
        container.style.display = sel.value === 'MULTIPLE' ? 'block' : 'none';
    },

    toggleVesselAllocation(vesselId) {
        const chk = document.querySelector(`.l-vessel-checkbox[data-vessel-id="${vesselId}"]`);
        const inp = document.getElementById(`l-alloc-${vesselId}`);
        if (!chk || !inp) return;
        inp.style.display = chk.checked ? 'block' : 'none';
        if (!chk.checked) inp.value = '';
        this.calculateTotalAllocation();
    },

    calculateTotalAllocation() {
        const loanAmountEl = document.getElementById('l-loanAmount');
        const loanAmount = loanAmountEl ? (Number(loanAmountEl.value) || 0) : 0;
        let total = 0;
        document.querySelectorAll('.l-vessel-alloc-input').forEach(inp => {
            if (inp.style.display !== 'none') total += Number(inp.value) || 0;
        });
        const totalEl = document.getElementById('l-total-alloc-display');
        const unallocEl = document.getElementById('l-unalloc-display');
        if (totalEl) totalEl.textContent = new Intl.NumberFormat('vi-VN').format(total);
        if (unallocEl) unallocEl.textContent = new Intl.NumberFormat('vi-VN').format(loanAmount - total);
    },

    _advancePeriodDate(fromDateStr, period) {
        if (!fromDateStr) return fromDateStr;
        const d = new Date(fromDateStr);
        if (isNaN(d.getTime())) return fromDateStr;
        switch (period) {
            case 'monthly':    d.setMonth(d.getMonth() + 1); break;
            case 'quarterly':  d.setMonth(d.getMonth() + 3); break;
            case 'half-yearly':d.setMonth(d.getMonth() + 6); break;
            case 'yearly':     d.setFullYear(d.getFullYear() + 1); break;
            default:           d.setMonth(d.getMonth() + 1); break;
        }
        return d.toISOString().substring(0, 10);
    },

    // =====================================================================
    // MONTHLY VESSEL REPORT BREAKDOWN
    // =====================================================================

    getMonthlyVesselReportBreakdown(vesselId, monthStr) {
        if (!monthStr || !vesselId) {
            return { revenue: 0, doCost: 0, loCost: 0, agent: 0, advances: 0, salary: 0,
                     interest: 0, insurance: 0, vat: 0, material: 0, other: 0, totalCost: 0, closingBalance: 0 };
        }

        const key = `monthly_vessel_report_inputs_${vesselId}_${monthStr}`;
        const stored = localStorage.getItem(key);
        let overrides = {};
        let customTotal = 0;

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.overrides) overrides = parsed.overrides;
                if (parsed.customExpenses) {
                    parsed.customExpenses.forEach(exp => {
                        customTotal += Number(exp.amount) || 0;
                    });
                }
            } catch (e) {}
        }

        const [year, month] = monthStr.split('-').map(Number);

        // Revenue
        const ships = AppData.getShipments();
        const shipments = ships.filter(s => {
            const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
            return s.vesselId === vesselId && m === monthStr;
        });
        const revenue = shipments.reduce((sum, s) => {
            let sTotal = Number(s.revenueReal || 0);
            if (s.revenueInvoice > s.revenueReal) {
                const rate = s.commissionRate !== undefined ? s.commissionRate / 100
                    : ((s.contractNo === 'HD25' || s.contractNo === 'HD54') ? 0.20 : 0.28);
                sTotal += Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * rate);
            }
            return sum + sTotal;
        }, 0);

        // Costs
        const txs = (AppData.state.transactions || []).filter(t =>
            t.vessel === vesselId && t.date && t.date.substring(0, 7) === monthStr
        );

        const doCost = overrides.doCost !== undefined ? Number(overrides.doCost) :
            (AppData.state.fuelVoyages || [])
                .filter(v => v.vesselId === vesselId && AppData.parseYearMonth(v.fuelDate) === monthStr)
                .reduce((sum, v) => sum + Math.round((Number(v.addedFuel) || 0) * (Number(v.fuelUnitPrice) || 0)), 0);

        const loCost = overrides.loCost !== undefined ? Number(overrides.loCost) :
            (AppData.state.loSupplies || [])
                .filter(s => s.vesselId === vesselId && s.date && s.date.substring(0, 7) === monthStr)
                .reduce((sum, s) => sum + Math.round((Number(s.qty) || 0) * (Number(s.price) || 0)), 0);

        const advances = overrides.advances !== undefined ? Number(overrides.advances) :
            txs.filter(t => t.category && (
                t.category === '1.Tàu Ứng' ||
                t.category === '1.Tàu ứng' ||
                t.category.trim().toLowerCase().includes('tàu ứng')
            )).reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        const monthlyCost = AppData.getMonthlyCosts(monthStr, vesselId);
        const salary = overrides.salary !== undefined ? Number(overrides.salary) : (monthlyCost.salary || 0);

        const interest = overrides.interest !== undefined ? Number(overrides.interest) :
            txs.filter(t => t.category === '6.Lãi Vay' || t.category === '6.Lại Vay')
               .reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        const agent = overrides.agent !== undefined ? Number(overrides.agent) :
            txs.filter(t => t.category === '2.Chi Phí Cảng')
               .reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        const material = overrides.material !== undefined ? Number(overrides.material) :
            txs.filter(t => t.category === '9.Vật Tư')
               .reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        const daysInMonth = new Date(year, month, 0).getDate();
        const annualConfig = AppData.getAnnualCosts(year, vesselId);
        const hullInsurance = Math.round(daysInMonth * (annualConfig.hullInsuranceDaily || 0));
        const socialInsurance = monthlyCost.insurance || 0;
        const hullInsuranceVal = overrides.hullInsurance !== undefined ? Number(overrides.hullInsurance) : hullInsurance;
        const socialInsuranceVal = overrides.socialInsurance !== undefined ? Number(overrides.socialInsurance) : socialInsurance;
        let insurance = hullInsuranceVal + socialInsuranceVal;
        if (overrides.hullInsurance === undefined && overrides.socialInsurance === undefined && overrides.insurance !== undefined) {
            insurance = Number(overrides.insurance);
        }

        const autoVat = shipments.reduce((sum, s) => sum + (Number(s.costs?.vat) || 0), 0);
        const vat = overrides.vat !== undefined ? Number(overrides.vat) : autoVat;

        const other = customTotal;

        const totalCost = doCost + loCost + advances + salary + interest + agent + material + insurance + vat + other;

        const inputs = this.getMonthlyVesselReportInputs(vesselId, monthStr);
        const openingBalance = inputs.openingBalance;
        const closingBalance = openingBalance + revenue - totalCost;

        return { revenue, doCost, loCost, agent, advances, salary, interest, insurance, vat, material, other, totalCost, closingBalance };
    },

    toggleSelectAllCompare(checked) {
        document.querySelectorAll('.shipment-compare-chk').forEach(cb => {
            cb.checked = checked;
        });
        this.updateSelectedComparisonCount();
    },

    updateSelectedComparisonCount() {
        const count = document.querySelectorAll('.shipment-compare-chk:checked').length;
        const btn = document.getElementById('shipment-compare-btn');
        if (btn) {
            if (count >= 2) {
                btn.innerHTML = `<i class="fa-solid fa-chart-column"></i> So Sánh (${count})`;
                btn.classList.remove('btn-outline');
                btn.classList.add('btn-primary');
            } else {
                btn.innerHTML = `<i class="fa-solid fa-chart-column"></i> So Sánh Chuyến`;
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-outline');
            }
        }
    },

    openShipmentCompareModal() {
        try {
            const checkedBoxes = document.querySelectorAll('.shipment-compare-chk:checked');
            const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);
            
            let id1 = selectedIds[0] || '';
            let id2 = selectedIds[1] || '';
            let id3 = selectedIds[2] || '';
            
            const shipments = AppData.getShipments();
            if (shipments.length < 2) {
                alert("Bạn cần có ít nhất 2 chuyến hàng trong hệ thống để thực hiện so sánh!");
                return;
            }
            
            if (!id1 || !id2) {
                const sortedShipments = shipments.slice().sort((a, b) => {
                    const dateA = a.dateStart || '';
                    const dateB = b.dateStart || '';
                    return dateB.localeCompare(dateA);
                });
                id1 = id1 || sortedShipments[0]?.id || '';
                id2 = id2 || sortedShipments[1]?.id || '';
            }
            
            this.renderShipmentCompareModal(id1, id2, id3);
            this.openModal('shipment-compare-modal');
        } catch (err) {
            console.error(err);
            alert("LỖI KHI MỞ SO SÁNH CHUYẾN:\n" + err.message + "\n\nStack:\n" + err.stack);
        }
    },

    updateComparisonSelection() {
        const id1 = document.getElementById('compare-s1').value;
        const id2 = document.getElementById('compare-s2').value;
        const id3 = document.getElementById('compare-s3').value;
        this.renderShipmentCompareModal(id1, id2, id3);
    },

    renderShipmentCompareModal(id1, id2, id3 = '') {
        const container = document.getElementById('shipment-compare-modal-content');
        if (!container) return;
        
        container.innerHTML = Views.shipmentCompare(id1, id2, id3);
        
        if (this.compareCharts) {
            Object.values(this.compareCharts).forEach(c => {
                if (c && typeof c.destroy === 'function') c.destroy();
            });
        }
        this.compareCharts = {};
        
        const canvasFin = document.getElementById('compareFinancialsChart');
        const canvasCost = document.getElementById('compareCostsChart');
        if (!canvasFin || !canvasCost) return;
        
        if (typeof Chart === 'undefined') {
            console.warn("Chart.js not loaded. Skipping rendering of compare charts.");
            return;
        }
        
        const s1 = AppData.getShipment(id1);
        const s2 = AppData.getShipment(id2);
        const s3 = id3 ? AppData.getShipment(id3) : null;
        
        const f1 = AppData.calculateShipmentFinancials(s1);
        const f2 = AppData.calculateShipmentFinancials(s2);
        const f3 = s3 ? AppData.calculateShipmentFinancials(s3) : null;
        
        const labels = [`HĐ ${s1.contractNo || s1.voyageNo}`, `HĐ ${s2.contractNo || s2.voyageNo}`];
        if (s3) labels.push(`HĐ ${s3.contractNo || s3.voyageNo}`);
        
        const revenues = [s1.revenueReal, s2.revenueReal];
        if (s3) revenues.push(s3.revenueReal);
        
        const costs = [f1.costSum + f1.vat, f2.costSum + f2.vat];
        if (s3) costs.push(f3.costSum + f3.vat);
        
        const profits = [f1.profit, f2.profit];
        if (s3) profits.push(f3.profit);
        
        this.compareCharts.fin = new Chart(canvasFin, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Doanh thu thực',
                        data: revenues,
                        backgroundColor: 'rgba(14, 165, 233, 0.75)',
                        borderColor: '#0ea5e9',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Tổng chi phí',
                        data: costs,
                        backgroundColor: 'rgba(244, 63, 94, 0.75)',
                        borderColor: '#f43f5e',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Lợi nhuận ròng',
                        data: profits,
                        backgroundColor: 'rgba(16, 185, 129, 0.75)',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + AppData.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: value => (value / 1e6).toFixed(0) + 'M' }
                    },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
                }
            }
        });
        
        const costLabels = ['Dầu DO', 'Lương Crew', 'Đại lý & Cảng', 'Khấu hao vỏ', 'Lên đà định kỳ'];
        
        const values1 = [
            Number(s1.costs?.fuelDO || 0),
            Number(s1.costs?.crewSalary || 0),
            Number(s1.costs?.agent || 0) + Number(s1.costs?.portFees || 0),
            Number(s1.costs?.depreciation || 0),
            Number(s1.costs?.dockingPeriodic || 0)
        ];
        
        const values2 = [
            Number(s2.costs?.fuelDO || 0),
            Number(s2.costs?.crewSalary || 0),
            Number(s2.costs?.agent || 0) + Number(s2.costs?.portFees || 0),
            Number(s2.costs?.depreciation || 0),
            Number(s2.costs?.dockingPeriodic || 0)
        ];
        
        const datasets = [
            {
                label: `HĐ ${s1.contractNo || s1.voyageNo}`,
                data: values1,
                backgroundColor: 'rgba(14, 165, 233, 0.75)',
                borderColor: '#0ea5e9',
                borderWidth: 1,
                borderRadius: 4
            },
            {
                label: `HĐ ${s2.contractNo || s2.voyageNo}`,
                data: values2,
                backgroundColor: 'rgba(245, 158, 11, 0.75)',
                borderColor: '#f59e0b',
                borderWidth: 1,
                borderRadius: 4
            }
        ];
        
        if (s3) {
            const values3 = [
                Number(s3.costs?.fuelDO || 0),
                Number(s3.costs?.crewSalary || 0),
                Number(s3.costs?.agent || 0) + Number(s3.costs?.portFees || 0),
                Number(s3.costs?.depreciation || 0),
                Number(s3.costs?.dockingPeriodic || 0)
            ];
            datasets.push({
                label: `HĐ ${s3.contractNo || s3.voyageNo}`,
                data: values3,
                backgroundColor: 'rgba(168, 85, 247, 0.75)',
                borderColor: '#a855f7',
                borderWidth: 1,
                borderRadius: 4
            });
        }
        
        this.compareCharts.cost = new Chart(canvasCost, {
            type: 'bar',
            data: {
                labels: costLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + AppData.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: value => (value / 1e6).toFixed(0) + 'M' }
                    },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
                }
            }
        });
    },

    openVirtualShipmentModal() {
        try {
            const vessels = AppData.getVessels();
            if (!vessels || vessels.length === 0) {
                alert("Hệ thống chưa có dữ liệu tàu. Hãy thêm tàu trước!");
                return;
            }
            
            const firstVesselId = vessels[0].id;
            
            // Prepopulate 2-3 default scenarios for firstVesselId
            // We can look up the last shipment of this vessel to suggest a default cargo and ports
            const vesselShipments = AppData.getShipments().filter(s => s.vesselId === firstVesselId);
            const latestShipment = vesselShipments[0] || {};
            
            const defaultScenarios = [
                {
                    pLoad: latestShipment.portLoad || 'Cảng Xếp 1',
                    pDis: latestShipment.portDischarge || 'Cảng Dỡ 1',
                    qty: Number(latestShipment.qty) || 3000,
                    rate: Number(latestShipment.rate) || 150000,
                    dateStart: new Date().toISOString().split('T')[0],
                    dateEnd: new Date(Date.now() + 10*24*3600*1000).toISOString().split('T')[0],
                    hours: 120,
                    doPrice: 20000,
                    loPrice: 85000,
                    agentPortFees: 50000000,
                    brokerage: 0,
                    others: 0
                },
                {
                    pLoad: latestShipment.portLoad || 'Cảng Xếp 2',
                    pDis: latestShipment.portDischarge || 'Cảng Dỡ 2',
                    qty: Number(latestShipment.qty) || 3000,
                    rate: Number(latestShipment.rate) || 160000,
                    dateStart: new Date().toISOString().split('T')[0],
                    dateEnd: new Date(Date.now() + 12*24*3600*1000).toISOString().split('T')[0],
                    hours: 140,
                    doPrice: 20000,
                    loPrice: 85000,
                    agentPortFees: 60000000,
                    brokerage: 0,
                    others: 0
                },
                {
                    pLoad: '',
                    pDis: '',
                    qty: '',
                    rate: '',
                    dateStart: '',
                    dateEnd: '',
                    hours: '',
                    doPrice: 20000,
                    loPrice: 85000,
                    agentPortFees: '',
                    brokerage: '',
                    others: ''
                }
            ];
            
            this.virtualScenarios = defaultScenarios;
            this.activeVirtualVessel = firstVesselId;
            
            const container = document.getElementById('virtual-shipment-modal-content');
            if (container) {
                container.innerHTML = Views.virtualShipmentSimulator(firstVesselId, defaultScenarios);
            }
            
            this.openModal('virtual-shipment-modal');
            this.recalculateVirtualShipment();
        } catch (err) {
            console.error(err);
            alert("LỖI KHI MỞ GIẢ LẬP CHUYẾN:\n" + err.message);
        }
    },
    
    updateVirtualShipmentVessel(vesselId) {
        try {
            this.activeVirtualVessel = vesselId;
            const vesselShipments = AppData.getShipments().filter(s => s.vesselId === vesselId);
            const latestShipment = vesselShipments[0] || {};
            
            // Read current values of inputs to preserve them if possible
            for (let i = 0; i < 3; i++) {
                if (document.getElementById(`sim-pLoad-${i}`)) {
                    this.virtualScenarios[i] = {
                        pLoad: document.getElementById(`sim-pLoad-${i}`).value,
                        pDis: document.getElementById(`sim-pDis-${i}`).value,
                        qty: document.getElementById(`sim-qty-${i}`).value === '' ? '' : Number(document.getElementById(`sim-qty-${i}`).value),
                        rate: document.getElementById(`sim-rate-${i}`).value === '' ? '' : Number(document.getElementById(`sim-rate-${i}`).value),
                        dateStart: document.getElementById(`sim-start-${i}`).value,
                        dateEnd: document.getElementById(`sim-end-${i}`).value,
                        hours: document.getElementById(`sim-hours-${i}`).value === '' ? '' : Number(document.getElementById(`sim-hours-${i}`).value),
                        doPrice: Number(document.getElementById(`sim-doPrice-${i}`).value) || 20000,
                        loPrice: Number(document.getElementById(`sim-loPrice-${i}`).value) || 85000,
                        agentPortFees: document.getElementById(`sim-portFees-${i}`).value === '' ? '' : Number(document.getElementById(`sim-portFees-${i}`).value),
                        brokerage: Number(document.getElementById(`sim-brokerage-${i}`).value) || 0,
                        others: Number(document.getElementById(`sim-others-${i}`).value) || 0
                    };
                }
            }
            
            const container = document.getElementById('virtual-shipment-modal-content');
            if (container) {
                container.innerHTML = Views.virtualShipmentSimulator(vesselId, this.virtualScenarios);
            }
            this.recalculateVirtualShipment();
        } catch (err) {
            console.error(err);
        }
    },
    
    recalculateVirtualShipment() {
        try {
            const vesselId = this.activeVirtualVessel;
            const vessel = AppData.getVessel(vesselId);
            if (!vessel) return;
            
            const results = [];
            
            for (let i = 0; i < 3; i++) {
                const pLoad = document.getElementById(`sim-pLoad-${i}`).value;
                const pDis = document.getElementById(`sim-pDis-${i}`).value;
                const qtyVal = document.getElementById(`sim-qty-${i}`).value;
                const rateVal = document.getElementById(`sim-rate-${i}`).value;
                const dateStart = document.getElementById(`sim-start-${i}`).value;
                const dateEnd = document.getElementById(`sim-end-${i}`).value;
                const hoursVal = document.getElementById(`sim-hours-${i}`).value;
                const doPrice = Number(document.getElementById(`sim-doPrice-${i}`).value) || 0;
                const loPrice = Number(document.getElementById(`sim-loPrice-${i}`).value) || 0;
                const portFees = Number(document.getElementById(`sim-portFees-${i}`).value) || 0;
                const brokerage = Number(document.getElementById(`sim-brokerage-${i}`).value) || 0;
                const others = Number(document.getElementById(`sim-others-${i}`).value) || 0;
                
                // If it's Scenario 3 and it's completely empty, we can skip it or mark it inactive
                const isEmpty = (i === 2 && !qtyVal && !rateVal && !dateStart);
                
                if (isEmpty) {
                    results.push(null);
                    continue;
                }
                
                const qty = Number(qtyVal) || 0;
                const rate = Number(rateVal) || 0;
                const hours = Number(hoursVal) || 0;
                
                const days = AppData.calcDays(dateStart, dateEnd) || 1;
                
                // Doanh thu thực
                const revenueReal = qty * rate;
                
                // Chi phí dầu DO
                const doRate = Number(vessel.fuelRate) || 150; // default to 150 L/h
                const fuelDO = Math.round(hours * doRate * doPrice);
                
                // Chi phí dầu LO
                const loHours = Number(vessel.loHours) || 800;
                const loRepl = Number(vessel.loReplacementQty) || 8;
                const loTopup = Number(vessel.loTopupQty) || 3;
                const hourlyLORate = loHours > 0 ? ((loRepl + loTopup) / loHours) : 0;
                const fuelLO = Math.round(hours * hourlyLORate * loPrice);
                
                // Phân bổ chi phí cố định (crew salary, food, insurance, depreciation, loan bank, loan external, monthly other, annual costs)
                // We will look up monthly costs and annual costs based on the start date
                const year = dateStart ? new Date(dateStart).getFullYear() : new Date().getFullYear();
                const monthStr = dateStart ? dateStart.substring(0, 7) : new Date().toISOString().substring(0, 7);
                
                const monthlyCost = AppData.getMonthlyCosts(monthStr, vesselId);
                const annualConfig = AppData.getAnnualCosts(year, vesselId);
                
                // Daily rates
                const dailySalary = (Number(monthlyCost.salary) || 0) / 30;
                const dailyFood = (Number(monthlyCost.food) || 0) / 30;
                const dailyInsurance = (Number(monthlyCost.insurance) || 0) / 30;
                const dailyLoanInterest = (Number(monthlyCost.loanInterest) || 0) / 30;
                const dailyLoanInterestExternal = (Number(monthlyCost.loanInterestExternal) || 0) / 30;
                const dailyOtherMonthly = (Number(monthlyCost.other) || 0) / 30;
                const dailyMaterialCompany = (Number(monthlyCost.materialCompany) || 0) / 30;
                const dailyMaterialVessel = (Number(monthlyCost.materialVessel) || 0) / 30;
                
                const dailyDepreciation = Number(annualConfig.depreciationDaily) || 0;
                const dailyHullInsurance = Number(annualConfig.hullInsuranceDaily) || 0;
                const dailyLargeRepair = Number(annualConfig.largeRepairDaily) || 0;
                const dailyRegistryAnnual = Number(annualConfig.registryAnnualDaily) || 0;
                const dailyDockingIntermediate = Number(annualConfig.dockingIntermediateDaily) || 0;
                const dailyDockingPeriodic = Number(annualConfig.dockingPeriodicDaily) || 0;
                
                // Allocations
                const allocatedSalary = Math.round(dailySalary * days);
                const allocatedFood = Math.round(dailyFood * days);
                const allocatedInsurance = Math.round(dailyInsurance * days);
                const allocatedInterest = Math.round(dailyLoanInterest * days);
                const allocatedInterestExt = Math.round(dailyLoanInterestExternal * days);
                const allocatedOtherMonthly = Math.round(dailyOtherMonthly * days);
                const allocatedMaterialCompany = Math.round(dailyMaterialCompany * days);
                const allocatedMaterialVessel = Math.round(dailyMaterialVessel * days);
                
                const allocatedDepreciation = Math.round(dailyDepreciation * days);
                const allocatedHullInsurance = Math.round(dailyHullInsurance * days);
                const allocatedLargeRepair = Math.round(dailyLargeRepair * days);
                const allocatedRegistry = Math.round(dailyRegistryAnnual * days);
                const allocatedDockingInt = Math.round(dailyDockingIntermediate * days);
                const allocatedDockingPer = Math.round(dailyDockingPeriodic * days);
                
                const fixedCostSum = allocatedSalary + allocatedFood + allocatedInsurance + allocatedInterest + allocatedInterestExt + allocatedOtherMonthly + allocatedMaterialCompany + allocatedMaterialVessel + allocatedDepreciation + allocatedHullInsurance + allocatedLargeRepair + allocatedRegistry + allocatedDockingInt + allocatedDockingPer;
                
                // VAT chuyến: 8% Doanh thu - 8% (Dầu DO + Dầu LO + Phí Cảng)
                const deduc = fuelDO + fuelLO + portFees;
                const vat = Math.round((0.08 * revenueReal) - (0.08 * deduc));
                const vatVal = vat > 0 ? vat : 0;
                
                // Tổng chi phí
                const totalCosts = fuelDO + fuelLO + portFees + brokerage + others + fixedCostSum;
                
                // Lợi nhuận ròng
                const netProfit = (revenueReal - vatVal) - totalCosts;
                
                // Lợi nhuận / ngày
                const profitPerDay = Math.round(netProfit / days);
                
                results.push({
                    pLoad,
                    pDis,
                    qty,
                    rate,
                    days,
                    hours,
                    revenueReal,
                    fuelDO,
                    fuelLO,
                    portFees,
                    brokerage,
                    others,
                    fixedCostSum,
                    vatVal,
                    totalCosts,
                    netProfit,
                    profitPerDay
                });
            }
            
            // Build Results HTML rows
            const resultsBody = document.getElementById('sim-results-body');
            if (resultsBody) {
                const renderCellVal = (res, formatFn) => {
                    if (!res) return `<td style="padding:8px 10px; text-align:right; color:var(--text-muted);">---</td>`;
                    return `<td style="padding:8px 10px; text-align:right; font-weight:600; color:var(--text-main);">${formatFn(res)}</td>`;
                };
                
                resultsBody.innerHTML = `
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                        <td style="padding:8px 10px; text-align:left; color:var(--text-muted);">Tuyến đường</td>
                        ${results.map(r => r ? `<td style="padding:8px 10px; text-align:right; font-weight:600; color:var(--text-main);">${r.pLoad || '---'} &rarr; ${r.pDis || '---'}</td>` : `<td style="padding:8px 10px; text-align:right; color:var(--text-muted);">---</td>`).join('')}
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                        <td style="padding:8px 10px; text-align:left; color:var(--text-muted);">Sản lượng & Đơn giá cước</td>
                        ${results.map(r => r ? `<td style="padding:8px 10px; text-align:right; color:var(--text-main);">${r.qty.toLocaleString()} Tấn | ${AppData.formatCurrency(r.rate)} / Tấn</td>` : `<td style="padding:8px 10px; text-align:right; color:var(--text-muted);">---</td>`).join('')}
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                        <td style="padding:8px 10px; text-align:left; color:var(--text-muted);">Thời gian khai thác</td>
                        ${results.map(r => r ? `<td style="padding:8px 10px; text-align:right; color:var(--text-main);">${r.days} Ngày (${r.hours} Giờ biển)</td>` : `<td style="padding:8px 10px; text-align:right; color:var(--text-muted);">---</td>`).join('')}
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03); background: rgba(14, 165, 233, 0.03);">
                        <td style="padding:8px 10px; text-align:left; font-weight:600; color:var(--text-main);">DOANH THU THỰC DỰ PHÓNG</td>
                        ${results.map(r => renderCellVal(r, x => AppData.formatCurrency(x.revenueReal))).join('')}
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                        <td style="padding:8px 10px; text-align:left; color:var(--text-muted); padding-left: 20px;">- Chi phí dầu DO dự toán</td>
                        ${results.map(r => renderCellVal(r, x => AppData.formatCurrency(x.fuelDO))).join('')}
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                        <td style="padding:8px 10px; text-align:left; color:var(--text-muted); padding-left: 20px;">- Chi phí dầu LO dự toán</td>
                        ${results.map(r => renderCellVal(r, x => AppData.formatCurrency(x.fuelLO))).join('')}
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                        <td style="padding:8px 10px; text-align:left; color:var(--text-muted); padding-left: 20px;">- Chi phí Cảng & Đại lý nhập</td>
                        ${results.map(r => renderCellVal(r, x => AppData.formatCurrency(x.portFees))).join('')}
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                        <td style="padding:8px 10px; text-align:left; color:var(--text-muted); padding-left: 20px;">- Môi giới & Chi phí khác nhập</td>
                        ${results.map(r => renderCellVal(r, x => AppData.formatCurrency(x.brokerage + x.others))).join('')}
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                        <td style="padding:8px 10px; text-align:left; color:var(--text-muted); padding-left: 20px;">- Chi phí cố định phân bổ</td>
                        ${results.map(r => renderCellVal(r, x => AppData.formatCurrency(x.fixedCostSum))).join('')}
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03); color: var(--accent);">
                        <td style="padding:8px 10px; text-align:left; color:var(--text-muted); padding-left: 20px;">- Thuế VAT chuyến tạm tính</td>
                        ${results.map(r => renderCellVal(r, x => AppData.formatCurrency(x.vatVal))).join('')}
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03); background: rgba(244, 63, 94, 0.03);">
                        <td style="padding:8px 10px; text-align:left; font-weight:600; color:var(--text-main);">TỔNG CHI PHÍ (+VAT) DỰ PHÓNG</td>
                        ${results.map(r => renderCellVal(r, x => AppData.formatCurrency(x.totalCosts + x.vatVal))).join('')}
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.03); background: rgba(16, 185, 129, 0.03); border-top: 1px solid var(--border-color);">
                        <td style="padding:8px 10px; text-align:left; font-weight:600; color:var(--text-main);">LỢI NHUẬN RÒNG DỰ PHÓNG</td>
                        ${results.map(r => {
                            if (!r) return `<td style="padding:8px 10px; text-align:right; color:var(--text-muted);">---</td>`;
                            const color = r.netProfit >= 0 ? '#10b981' : '#ef4444';
                            return `<td style="padding:8px 10px; text-align:right; font-weight:700; color:${color};">${AppData.formatCurrency(r.netProfit)}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="border-bottom: 2px solid var(--border-color); background: rgba(168, 85, 247, 0.03);">
                        <td style="padding:8px 10px; text-align:left; font-weight:600; color:var(--text-main);">HIỆU QUẢ RÒNG TRUNG BÌNH / NGÀY</td>
                        ${results.map(r => {
                            if (!r) return `<td style="padding:8px 10px; text-align:right; color:var(--text-muted);">---</td>`;
                            const color = r.profitPerDay >= 0 ? '#10b981' : '#ef4444';
                            return `<td style="padding:8px 10px; text-align:right; font-weight:700; color:${color};">${AppData.formatCurrency(r.profitPerDay)} / ngày</td>`;
                        }).join('')}
                    </tr>
                `;
            }
            
            // Build recommendations
            const recsCard = document.getElementById('sim-recs-card');
            if (recsCard) {
                const validScenarios = results.filter(r => r !== null);
                if (validScenarios.length >= 2) {
                    recsCard.style.display = 'block';
                    
                    // Find highest total profit scenario
                    let bestTotalIdx = 0;
                    let maxTotalProfit = -Infinity;
                    
                    // Find highest daily profit scenario
                    let bestDailyIdx = 0;
                    let maxDailyProfit = -Infinity;
                    
                    results.forEach((r, idx) => {
                        if (r) {
                            if (r.netProfit > maxTotalProfit) {
                                maxTotalProfit = r.netProfit;
                                bestTotalIdx = idx;
                            }
                            if (r.profitPerDay > maxDailyProfit) {
                                maxDailyProfit = r.profitPerDay;
                                bestDailyIdx = idx;
                            }
                        }
                    });
                    
                    let recsHtml = `
                        <h4 style="margin:0 0 10px 0; font-size:0.9rem; font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-wand-magic-sparkles" style="color:var(--accent);"></i> Phân Tích Kịch Bản Giả Lập & Khuyến Nghị
                        </h4>
                        <ul style="margin: 0; padding-left: 10px; list-style: none;">
                    `;
                    
                    if (bestTotalIdx === bestDailyIdx) {
                        recsHtml += `
                            <li style="margin-bottom: 8px; line-height: 1.4; font-size: 0.85rem;">
                                <i class="fa-solid fa-circle-check" style="color:#10b981; margin-right: 6px;"></i>
                                <strong>Định hướng tối ưu:</strong> Kịch bản ${bestTotalIdx + 1} (${results[bestTotalIdx].pLoad || '---'} &rarr; ${results[bestTotalIdx].pDis || '---'}) là lựa chọn tốt nhất toàn diện. Tuyến này mang lại cả **Lợi nhuận ròng tổng thể cao nhất** (${AppData.formatCurrency(maxTotalProfit)}) và **Hiệu suất khai thác ngày tối ưu nhất** (${AppData.formatCurrency(maxDailyProfit)}/ngày). Bạn nên ưu tiên đàm phán ký kết hợp đồng cho kịch bản này.
                            </li>
                        `;
                    } else {
                        recsHtml += `
                            <li style="margin-bottom: 8px; line-height: 1.4; font-size: 0.85rem;">
                                <i class="fa-solid fa-circle-info" style="color:var(--warning); margin-right: 6px;"></i>
                                <strong>So sánh Lợi nhuận tổng thể:</strong> Kịch bản ${bestTotalIdx + 1} (${results[bestTotalIdx].pLoad || '---'} &rarr; ${results[bestTotalIdx].pDis || '---'}) có **Tổng lợi nhuận ròng cao nhất** (${AppData.formatCurrency(maxTotalProfit)} trong ${results[bestTotalIdx].days} ngày).
                            </li>
                            <li style="margin-bottom: 8px; line-height: 1.4; font-size: 0.85rem;">
                                <i class="fa-solid fa-bolt" style="color:var(--secondary); margin-right: 6px;"></i>
                                <strong>So sánh Hiệu suất ngày:</strong> Kịch bản ${bestDailyIdx + 1} (${results[bestDailyIdx].pLoad || '---'} &rarr; ${results[bestDailyIdx].pDis || '---'}) lại vượt trội về **Hiệu suất khai thác ngày** (${AppData.formatCurrency(maxDailyProfit)}/ngày, chạy trong ${results[bestDailyIdx].days} ngày).
                            </li>
                            <li style="margin-top: 10px; line-height: 1.4; font-size: 0.85rem; border-top:1px dashed rgba(255,255,255,0.05); padding-top:10px;">
                                <i class="fa-solid fa-circle-question" style="color:var(--accent); margin-right: 6px;"></i>
                                <strong>Khuyến nghị định hướng:</strong> 
                                - Nếu sau chuyến này bạn đã có sẵn hợp đồng nối tiếp ngay lập tức, hãy chọn **Kịch bản ${bestDailyIdx + 1}** để tối đa hóa dòng tiền mỗi ngày.
                                - Nếu sau chuyến này tàu có khả năng phải neo chờ hàng hoặc chưa có tuyến gối đầu, hãy chọn **Kịch bản ${bestTotalIdx + 1}** để đảm bảo gom được lợi nhuận tổng lớn nhất cho đợt khai thác này.
                            </li>
                        `;
                    }
                    
                    recsHtml += `</ul>`;
                    recsCard.innerHTML = recsHtml;
                } else {
                    recsCard.style.display = 'none';
                }
            }
        } catch (err) {
            console.error("LỖI RECALC VIRTUAL SHIPMENT:", err);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        app.init();
    } catch (err) {
        alert('LỖI KHỞI CHẠY HỆ THỐNG:\n' + err.message + '\n\nStack:\n' + err.stack);
    }
});
