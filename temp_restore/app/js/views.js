/**
 * View Templates V2.0
 */

const Views = {
    dashboard: (filterMonth = '') => {
        const company = AppData.getCompany();
        const allShips = AppData.getShipments().filter(s => s.contractNo && s.contractNo.trim() !== '');
        
        // Thu thập danh sách các năm, quý, tháng có dữ liệu chuyến hàng
        const yearsSet = new Set();
        const quartersSet = new Set();
        const monthsSet = new Set();
        
        allShips.forEach(s => {
            const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
            if (m && m.length === 7) {
                monthsSet.add(m);
                const year = m.substring(0, 4);
                yearsSet.add(year);
                
                const mm = Number(m.split('-')[1]);
                const q = Math.ceil(mm / 3);
                quartersSet.add(`${year}-Q${q}`);
            }
        });
        
        const availableYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
        const availableQuarters = Array.from(quartersSet).sort((a, b) => b.localeCompare(a));
        const availableMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

        let filteredShips = allShips;
        if (filterMonth) {
            filteredShips = allShips.filter(s => {
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
        
        let totalRevenue = 0;
        let totalCost = 0;

        filteredShips.forEach(s => {
            totalRevenue += Number(s.revenueReal || 0);
            const vat = Math.round((0.08 * (s.revenueInvoice || s.revenueReal)) - (0.10 * (s.costs?.fuelDO || 0)));
            const baseCosts = { ...s.costs };
            delete baseCosts.vat; // Tránh cộng dồn
            if (app.excludeDockingDepreciation) {
                delete baseCosts.dockingIntermediate;
                delete baseCosts.dockingPeriodic;
                delete baseCosts.depreciation;
            }
            const costSum = Object.values(baseCosts).reduce((sum, v) => sum + (Number(v) || 0), 0) + (vat > 0 ? vat : 0);
            totalCost += costSum;
        });

        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

        const transForBalance = AppData.getTransactions() || [];
        const totalOpening = Object.values(AppData.state.company.openingBalances || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        const totalTrans = transForBalance.reduce((sum, t) => sum + (Number(t.thu) || 0) - (Number(t.chi) || 0), 0);
        const totalBalance = totalOpening + totalTrans;

        const accountBalancesHtml = ['ABbank', 'Viettinbank', 'Tài khoản cá nhân', 'Tiền mặt'].map(acc => {
            const opening = (AppData.state.company.openingBalances && AppData.state.company.openingBalances[acc]) || 0;
            const balance = opening + transForBalance.filter(t => t.account === acc).reduce((sum, t) => sum + (Number(t.thu) || 0) - (Number(t.chi) || 0), 0);
            let shortName = acc;
            if (acc === 'Tài khoản cá nhân') shortName = 'Cá nhân';
            return `
                <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
                    <span style="margin-right: 6px;">${shortName}:</span>
                    <span style="font-weight:500; color:var(--text-main);">${AppData.formatCurrency(balance)}</span>
                </div>
            `;
        }).join('');

        const { totalCustomerDebt } = AppData.getCustomerDebts();
        const supplierDebtsList = AppData.getSupplierDebts();
        const totalSupplierDebt = supplierDebtsList.reduce((sum, s) => sum + s.debt, 0);

        // Blue Box and Red Box Calculations
        let totalFuelQty = 0;
        let totalFuelVal = 0;
        const vesselsList = AppData.getVessels() || [];
        
        const blueBoxRowsHtml = vesselsList.map(v => {
            const voyages = AppData.getFuelVoyages(v.id);
            const sortedAsc = AppData.sortVoyages(voyages, 'asc');
            const qtyRemaining = AppData.getVesselFuelBalance(v.id);
            
            let valRemaining = 0;
            let initialFuelC1 = 0;
            let priceC1 = 0;
            let latestPrice = 0;
            
            if (sortedAsc.length > 0) {
                const c1 = sortedAsc[0];
                initialFuelC1 = Number(c1.initialFuel || 0);
                priceC1 = Number(c1.fuelUnitPrice || 0);
                if (priceC1 === 0) {
                    priceC1 = AppData.getLastFuelPrice(v.id, c1.voyageNo);
                }
                latestPrice = AppData.getLastFuelPrice(v.id);
                valRemaining = (qtyRemaining * latestPrice) - (initialFuelC1 * priceC1);
            }
            
            totalFuelQty += qtyRemaining;
            totalFuelVal += valRemaining;
            
            const qtyFormatted = new Intl.NumberFormat('vi-VN').format(Math.round(qtyRemaining || 0));
            const valFormatted = AppData.formatCurrency(valRemaining);
            
            const tooltip = `Giá trị = (Tồn cuối chuyến * Đơn giá gần nhất) - (Tồn trước C1 * Đơn giá C1)\n= (${qtyFormatted} * ${AppData.formatCurrency(latestPrice)}) - (${new Intl.NumberFormat('vi-VN').format(initialFuelC1)} * ${AppData.formatCurrency(priceC1)})`;
            
            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 3px 6px; font-weight: 500; border: none;">${v.name}</td>
                    <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: var(--text-main); border: none;">${qtyFormatted} Lít</td>
                    <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: ${valRemaining >= 0 ? '#10b981' : '#ef4444'}; border: none;" title="${tooltip}">${valFormatted}</td>
                </tr>
            `;
        }).join('');
        
        const totalFuelQtyFormatted = new Intl.NumberFormat('vi-VN').format(Math.round(totalFuelQty || 0));
        const totalFuelValFormatted = AppData.formatCurrency(totalFuelVal);

        let totalAllocatedCosts = 0;
        const redBoxRowsHtml = vesselsList.map(v => {
            const shipShipments = filteredShips.filter(s => s.vesselId === v.id);
            let sumDockingInt = 0;
            let sumDockingPer = 0;
            let sumDepreciation = 0;
            let sumRegistryAnnual = 0;
            let sumHullInsurance = 0;
            
            shipShipments.forEach(s => {
                const c = s.costs || {};
                sumDockingInt += app.excludeDockingDepreciation ? 0 : Number(c.dockingIntermediate || 0);
                sumDockingPer += app.excludeDockingDepreciation ? 0 : Number(c.dockingPeriodic || 0);
                sumDepreciation += app.excludeDockingDepreciation ? 0 : Number(c.depreciation || 0);
                sumRegistryAnnual += Number(c.registryAnnual || 0);
                sumHullInsurance += Number(c.hullInsurance || 0);
            });
            
            const totalShipCosts = sumDockingInt + sumDockingPer + sumDepreciation + sumRegistryAnnual + sumHullInsurance;
            totalAllocatedCosts += totalShipCosts;
            
            const costsFormatted = AppData.formatCurrency(totalShipCosts);
            const tooltip = `Lên đà TG: ${AppData.formatCurrency(sumDockingInt)}\nLên đà ĐK: ${AppData.formatCurrency(sumDockingPer)}\nKhấu hao: ${AppData.formatCurrency(sumDepreciation)}\nĐăng kiểm: ${AppData.formatCurrency(sumRegistryAnnual)}\nBảo hiểm: ${AppData.formatCurrency(sumHullInsurance)}`;
            
            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 3px 6px; font-weight: 500; border: none;">${v.name}</td>
                    <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: var(--accent); border: none;" title="${tooltip}">${costsFormatted}</td>
                </tr>
            `;
        }).join('');
        
        const totalAllocatedCostsFormatted = AppData.formatCurrency(totalAllocatedCosts);

        let totalVoyagesCount = 0;
        const voyagesBoxRowsHtml = vesselsList.map(v => {
            const shipShipments = filteredShips.filter(s => s.vesselId === v.id);
            const count = shipShipments.length;
            totalVoyagesCount += count;
            
            const voyageList = shipShipments.map(s => `Chuyến ${s.voyageNo}`).join(', ') || 'Không có chuyến nào';
            const tooltip = `Danh sách chuyến: ${voyageList}`;
            
            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 3px 6px; font-weight: 500; border: none;">${v.name}</td>
                    <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: #3b82f6; border: none;" title="${tooltip}">${count} chuyến</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="view-section">
                <!-- Page Header & Filter -->
                <div class="page-header" style="flex-wrap: wrap; gap: 1.5rem; align-items: center; margin-bottom: 1.5rem;">
                    <div>
                        <h1 class="page-title">Tổng quan</h1>
                        <p class="page-subtitle">${company.name}</p>
                    </div>
                    
                    <!-- Ô màu xanh thứ nhất: Số dư tài khoản & Tổng số dư -->
                    <div class="header-widget glass-card" style="display: flex; flex-direction: column; padding: 10px 16px; gap: 4px; font-size: 0.8rem; border-left: 3px solid var(--secondary); background: rgba(16, 185, 129, 0.05); min-width: 260px;">
                        <div style="display: flex; justify-content: space-between; font-weight: bold; color: var(--secondary); border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; margin-bottom: 2px;">
                            <span>TỔNG SỐ DƯ TÀI KHOẢN:</span>
                            <span>${AppData.formatCurrency(totalBalance)}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; color: var(--text-muted);">
                            ${accountBalancesHtml}
                        </div>
                    </div>
                    
                    <!-- Ô màu xanh thứ hai: Tổng công nợ Khách hàng & Nhà cung cấp -->
                    <div class="header-widget glass-card" style="display: flex; flex-direction: column; padding: 10px 16px; gap: 4px; font-size: 0.8rem; border-left: 3px solid var(--info); background: rgba(14, 165, 233, 0.05); min-width: 250px; justify-content: center;">
                        <div style="display: flex; justify-content: space-between; padding-bottom: 2px;">
                            <span style="color: var(--text-muted); font-weight: 500;">Công nợ Khách hàng:</span>
                            <span style="color: var(--accent); font-weight: bold;">${AppData.formatCurrency(totalCustomerDebt)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;">
                            <span style="color: var(--text-muted); font-weight: 500;">Công nợ NCC (Dầu):</span>
                            <span style="color: var(--warning); font-weight: bold;">${AppData.formatCurrency(totalSupplierDebt)}</span>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.75rem; background: rgba(255,255,255,0.03); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-left: auto;">
                        <label style="font-weight: 600; color: var(--text-main); font-size: 0.9rem; margin: 0; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-filter" style="color:var(--primary-light);"></i> Kỳ hạch toán:
                        </label>
                        <select class="form-control" style="width: 220px; height: 32px; padding: 4px 8px; font-size: 0.85rem;" onchange="app.navigate('dashboard', this.value)">
                            <option value="">-- Tất cả thời gian --</option>
                            <optgroup label="Theo Năm">
                                ${availableYears.map(y => `<option value="${y}" ${y === filterMonth ? 'selected' : ''}>Năm ${y}</option>`).join('')}
                            </optgroup>
                            <optgroup label="Theo Quý">
                                ${availableQuarters.map(q => {
                                    const [y, qNum] = q.split('-Q');
                                    return `<option value="${q}" ${q === filterMonth ? 'selected' : ''}>Quý ${qNum}/${y}</option>`;
                                }).join('')}
                            </optgroup>
                            <optgroup label="Theo Tháng">
                                ${availableMonths.map(m => {
                                    const [y, mm] = m.split('-');
                                    return `<option value="${m}" ${m === filterMonth ? 'selected' : ''}>Tháng ${mm}/${y}</option>`;
                                }).join('')}
                            </optgroup>
                        </select>
                    </div>
                </div>

                <!-- KPI Section Row 1: Fuel, Fixed Costs & Voyage Count (Compact grid-3 row) -->
                <div class="grid-3" style="margin-bottom: 1.5rem;">
                    <!-- Ô màu xanh: Theo dõi Dầu tồn DO & Giá trị -->
                    <div class="glass-card" style="border-left: 3px solid #3b82f6; background: rgba(59, 130, 246, 0.02); padding: 8px 12px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <h3 style="margin-top: 0; margin-bottom: 6px; font-size: 0.85rem; color: #3b82f6; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-gas-pump"></i> Lượng & Giá trị Dầu tồn DO
                            </h3>
                            <div class="table-container" style="margin: 0; padding: 0; background: transparent; border: none; box-shadow: none;">
                                <table class="table" style="width: 100%; font-size: 0.78rem; border-collapse: collapse; margin: 0;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); background: transparent;">
                                            <th style="text-align: left; padding: 3px 6px; color: var(--text-muted); font-weight: 600; background: transparent; border: none; font-size: 0.72rem;">Tàu</th>
                                            <th style="text-align: right; padding: 3px 6px; color: var(--text-muted); font-weight: 600; background: transparent; border: none; font-size: 0.72rem;">Tồn (1)</th>
                                            <th style="text-align: right; padding: 3px 6px; color: var(--text-muted); font-weight: 600; background: transparent; border: none; font-size: 0.72rem;">Giá trị (2)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${blueBoxRowsHtml}
                                        <tr style="border-top: 1px solid rgba(255,255,255,0.15); font-weight: bold; background: rgba(255,255,255,0.02);">
                                            <td style="padding: 4px 6px; color: var(--text-main); border: none;">Tổng cộng</td>
                                            <td style="padding: 4px 6px; text-align: right; color: var(--text-main); border: none;">${totalFuelQtyFormatted} Lít</td>
                                            <td style="padding: 4px 6px; text-align: right; color: ${totalFuelVal >= 0 ? '#10b981' : '#ef4444'}; border: none;">${totalFuelValFormatted}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Ô màu đỏ: Tổng chi phí cố định phân bổ -->
                    <div class="glass-card" style="border-left: 3px solid #ef4444; background: rgba(239, 68, 68, 0.02); padding: 8px 12px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0; margin-bottom: 6px;">
                                <h3 style="margin: 0; font-size: 0.85rem; color: #ef4444; display: flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-wrench"></i> Chi phí Cố định (Đà, Khấu hao, ĐK, BH)
                                </h3>
                                <label style="font-size: 0.72rem; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 4px; margin: 0;" title="Bỏ chi phí lên đà trung gian, định kỳ, khấu hao. Giữ lại đăng kiểm và bảo hiểm thân vỏ.">
                                    <input type="checkbox" id="exclude-docking-depr-chk" onchange="app.toggleExcludeDockingDepreciation(this.checked)" ${app.excludeDockingDepreciation ? 'checked' : ''} style="margin: 0; width: 12px; height: 12px;"> Bỏ đà & khấu hao
                                </label>
                            </div>
                            <div class="table-container" style="margin: 0; padding: 0; background: transparent; border: none; box-shadow: none;">
                                <table class="table" style="width: 100%; font-size: 0.78rem; border-collapse: collapse; margin: 0;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); background: transparent;">
                                            <th style="text-align: left; padding: 3px 6px; color: var(--text-muted); font-weight: 600; background: transparent; border: none; font-size: 0.72rem;">Tàu</th>
                                            <th style="text-align: right; padding: 3px 6px; color: var(--text-muted); font-weight: 600; background: transparent; border: none; font-size: 0.72rem;">Tổng chi phí</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${redBoxRowsHtml}
                                        <tr style="border-top: 1px solid rgba(255,255,255,0.15); font-weight: bold; background: rgba(255,255,255,0.02);">
                                            <td style="padding: 4px 6px; color: var(--text-main); border: none;">Tổng cộng</td>
                                            <td style="padding: 4px 6px; text-align: right; color: #ef4444; border: none;">${totalAllocatedCostsFormatted}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Ô màu xanh bên phải: Số chuyến thực hiện -->
                    <div class="glass-card" style="border-left: 3px solid #3b82f6; background: rgba(59, 130, 246, 0.02); padding: 8px 12px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <h3 style="margin-top: 0; margin-bottom: 6px; font-size: 0.85rem; color: #3b82f6; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-route"></i> Số chuyến đã thực hiện
                            </h3>
                            <div class="table-container" style="margin: 0; padding: 0; background: transparent; border: none; box-shadow: none;">
                                <table class="table" style="width: 100%; font-size: 0.78rem; border-collapse: collapse; margin: 0;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); background: transparent;">
                                            <th style="text-align: left; padding: 3px 6px; color: var(--text-muted); font-weight: 600; background: transparent; border: none; font-size: 0.72rem;">Tàu</th>
                                            <th style="text-align: right; padding: 3px 6px; color: var(--text-muted); font-weight: 600; background: transparent; border: none; font-size: 0.72rem;">Số chuyến</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${voyagesBoxRowsHtml}
                                        <tr style="border-top: 1px solid rgba(255,255,255,0.15); font-weight: bold; background: rgba(255,255,255,0.02);">
                                            <td style="padding: 4px 6px; color: var(--text-main); border: none;">Tổng cộng</td>
                                            <td style="padding: 4px 6px; text-align: right; color: #3b82f6; border: none;">${totalVoyagesCount} chuyến</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- KPI Section -->
                <div class="kpi-grid" style="margin-bottom: 2rem;">
                    <div class="kpi-card kpi-primary">
                        <div class="kpi-details">
                            <span class="kpi-title">Doanh thu Thực tế</span>
                            <span class="kpi-value" style="color: var(--info);">${AppData.formatCurrency(totalRevenue)}</span>
                        </div>
                        <div class="kpi-icon-wrapper">
                            <i class="fa-solid fa-money-bill-trend-up"></i>
                        </div>
                    </div>
                    <div class="kpi-card kpi-danger">
                        <div class="kpi-details">
                            <span class="kpi-title">Tổng Chi phí Chuy���n</span>
                            <span class="kpi-value" style="color: var(--accent);">${AppData.formatCurrency(totalCost)}</span>
                        </div>
                        <div class="kpi-icon-wrapper">
                            <i class="fa-solid fa-file-invoice-dollar"></i>
                        </div>
                    </div>
                    <div class="kpi-card kpi-success">
                        <div class="kpi-details">
                            <span class="kpi-title">Lợi nhuận Ròng</span>
                            <span class="kpi-value" style="color: var(--secondary);">${AppData.formatCurrency(totalProfit)}</span>
                        </div>
                        <div class="kpi-icon-wrapper">
                            <i class="fa-solid fa-scale-balanced"></i>
                        </div>
                    </div>
                    <div class="kpi-card kpi-info">
                        <div class="kpi-details">
                            <span class="kpi-title">Hiệu suất Lợi nhuận</span>
                            <span class="kpi-value" style="color: var(--warning);">${profitMargin}%</span>
                        </div>
                        <div class="kpi-icon-wrapper">
                            <i class="fa-solid fa-percent"></i>
                        </div>
                    </div>
                </div>

                <!-- Charts Layout -->
                <div class="charts-grid" style="margin-bottom: 2rem;">
                    <div class="chart-card-wrapper">
                        <div class="chart-card-header">
                            <span class="chart-card-title"><i class="fa-solid fa-ship" style="color: var(--info);"></i> Hiệu quả kinh doanh theo Tàu</span>
                        </div>
                        <div class="chart-card-body">
                            <canvas id="repVesselChart"></canvas>
                        </div>
                    </div>

                    <div class="chart-card-wrapper">
                        <div class="chart-card-header">
                            <span class="chart-card-title"><i class="fa-solid fa-chart-line" style="color: var(--primary-light);"></i> ${filterMonth ? 'Phân tích Doanh thu & Lợi nhuận từng Chuyến' : 'Xu hướng Doanh thu & Lợi nhuận'}</span>
                        </div>
                        <div class="chart-card-body">
                            <canvas id="repTrendChart"></canvas>
                        </div>
                    </div>

                    <div class="chart-card-wrapper">
                        <div class="chart-card-header">
                            <span class="chart-card-title"><i class="fa-solid fa-chart-pie" style="color: var(--secondary);"></i> Phân tích Cơ cấu Chi phí</span>
                        </div>
                        <div class="chart-card-body">
                            <canvas id="repCostChart"></canvas>
                        </div>
                    </div>

                    <div class="chart-card-wrapper">
                        <div class="chart-card-header">
                            <span class="chart-card-title"><i class="fa-solid fa-gas-pump" style="color: var(--warning);"></i> Tiêu hao Nhiên liệu DO theo Tàu (VNĐ)</span>
                        </div>
                        <div class="chart-card-body">
                            <canvas id="repFuelChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Auto Analysis Section -->
                <div class="glass-card" style="margin-bottom: 2rem; border-left: 4px solid var(--primary-light);">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                        <i class="fa-solid fa-brain" style="color: var(--primary-light); font-size: 1.5rem;"></i>
                        <h3 style="margin: 0; font-size: 1.25rem;">Báo cáo Phân tích & Nhận xét Kinh doanh</h3>
                    </div>
                    <div id="reports-analysis-content" style="line-height: 1.7; font-size: 0.95rem;">
                        <p style="color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i>Đang phân tích số liệu...</p>
                    </div>
                </div>

                <!-- Bottom Fleet & Transactions Grid -->
                <div class="grid-2">
                    <div class="glass-card">
                        <h3 style="display: flex; align-items: center; gap: 8px; font-size: 1.15rem; margin-bottom: 1rem;">
                            <i class="fa-solid fa-ship" style="color: var(--primary-light);"></i> Đội tàu & Thuyền trưởng
                        </h3>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>Tàu</th><th>Thuyền trưởng</th><th>Trạng thái</th></tr></thead>
                                <tbody>
                                    ${AppData.state.vessels.map(v => `
                                        <tr>
                                            <td><strong>${v.name}</strong></td>
                                            <td>${v.captain}</td>
                                            <td><span class="badge badge-success">Đang hành trình</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="glass-card">
                        <h3 style="display: flex; align-items: center; gap: 8px; font-size: 1.15rem; margin-bottom: 1rem;">
                            <i class="fa-solid fa-clock-rotate-left" style="color: var(--secondary);"></i> Giao dịch gần đây
                        </h3>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>Ngày</th><th>Nội dung</th><th>Số tiền</th></tr></thead>
                                <tbody>
                                    ${AppData.getTransactions().slice(0,5).map(t => `
                                        <tr>
                                            <td>${t.date ? t.date.split('-').reverse().join('/') : ''}</td>
                                            <td>${t.content}</td>
                                            <td class="${t.thu > 0 ? 'value-positive' : 'value-negative'}">
                                                ${AppData.formatCurrency(t.thu > 0 ? t.thu : -t.chi)}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    financials: (selectedMonth = '', selectedVessel = '', selectedCategory = '', selectedPartner = '') => {
        const currentTab = app.currentFinancialsTab || 'general';
        let tabContent = '';
        if (currentTab === 'loans') {
            tabContent = Views.loanTrackingContent();
        } else {
            tabContent = Views.financialsGeneralContent(selectedMonth, selectedVessel, selectedCategory, selectedPartner);
        }
        
        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Theo dõi Tài chính</h1>
                        <p class="page-subtitle">Quản lý thu chi và công nợ vay ngân hàng</p>
                    </div>
                    ${currentTab === 'loans' ? `
                    <button class="btn btn-primary" onclick="app.openLoanModal()">
                        <i class="fa-solid fa-plus"></i> Thêm Hợp đồng Vay
                    </button>
                    ` : `
                    <button class="btn btn-primary" onclick="app.openTransactionModal()">
                        <i class="fa-solid fa-plus"></i> Thêm Thu/Chi
                    </button>
                    `}
                </div>

                <div class="tabs" style="display:flex; gap:10px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">
                    <button class="btn ${currentTab !== 'loans' ? 'btn-primary' : 'btn-outline'}" onclick="app.changeFinancialsTab('general')">
                        <i class="fa-solid fa-chart-line"></i> Tổng quan & Dòng tiền
                    </button>
                    <button class="btn ${currentTab === 'loans' ? 'btn-primary' : 'btn-outline'}" onclick="app.changeFinancialsTab('loans')">
                        <i class="fa-solid fa-building-columns"></i> Nợ ngân hàng
                    </button>
                </div>

                ${tabContent}
            </div>
        `;
    },

    financialsGeneralContent: (selectedMonth = '', selectedVessel = '', selectedCategory = '', selectedPartner = '') => {
        const trans = AppData.getTransactions();
        return `
                <div class="grid-4" style="margin-bottom: 2rem;">
                    ${['ABbank', 'Viettinbank', 'Tài khoản cá nhân', 'Tiền mặt'].map(acc => {
                        const opening = (AppData.state.company.openingBalances && AppData.state.company.openingBalances[acc]) || 0;
                        const balance = opening + trans.filter(t => t.account === acc).reduce((sum, t) => sum + (Number(t.thu) || 0) - (Number(t.chi) || 0), 0);
                        let iconClass = 'fa-building-columns';
                        let colorClass = 'icon-blue';
                        if(acc === 'Tiền mặt') { iconClass = 'fa-money-bill-1'; colorClass = 'icon-green'; }
                        if(acc === 'Tài khoản cá nhân') { iconClass = 'fa-user-shield'; colorClass = 'icon-purple'; }
                        
                        return `
                            <div class="glass-card stat-card">
                                <div class="stat-header">
                                    <div class="stat-icon ${colorClass}"><i class="fa-solid ${iconClass}"></i></div>
                                    <span class="badge badge-outline">${acc}</span>
                                </div>
                                <div class="stat-value" style="font-size: 1.4rem;">${AppData.formatCurrency(balance)}</div>
                                <div class="stat-label">Số dư hiện tại</div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="glass-card" style="margin-bottom: 2rem; background: var(--gradient-primary); color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="color: white; opacity: 0.9;">TỔNG SỐ DƯ TẤT CẢ TÀI KHOẢN</h3>
                            <div style="font-size: 2.5rem; font-weight: 800;">
                                ${(() => {
                                    const totalOpening = Object.values(AppData.state.company.openingBalances || {}).reduce((s, v) => s + (Number(v) || 0), 0);
                                    const totalTrans = trans.reduce((sum, t) => sum + (Number(t.thu) || 0) - (Number(t.chi) || 0), 0);
                                    return AppData.formatCurrency(totalOpening + totalTrans);
                                })()}
                            </div>
                        </div>
                        <i class="fa-solid fa-vault" style="font-size: 4rem; opacity: 0.2;"></i>
                    </div>
                </div>

                <!-- Financial Analysis Section -->
                <div class="grid-1" style="margin-bottom: 2rem;">
                    <div class="glass-card" style="padding: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                            <div>
                                <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-chart-column" style="color: var(--primary-light); margin-right: 0.5rem;"></i>Biểu đồ Cân đối Tài chính</h3>
                                <p>Phân tích thu chi và lợi nhuận thực tế theo từng tháng</p>
                            </div>
                            <div class="grid-3" style="gap: 2rem; text-align: right;">
                                <div>
                                    <small class="stat-label">Tổng Thu (Tháng này)</small>
                                    <div id="monthly-thu-val" style="font-weight: 700; color: var(--secondary); font-size: 1.1rem;">0 đ</div>
                                </div>
                                <div>
                                    <small class="stat-label">Tổng Chi (Tháng này)</small>
                                    <div id="monthly-chi-val" style="font-weight: 700; color: var(--rose-light); font-size: 1.1rem;">0 đ</div>
                                </div>
                                <div>
                                    <small class="stat-label">Cân đối</small>
                                    <div id="monthly-balance-val" style="font-weight: 700; color: var(--info); font-size: 1.1rem;">0 đ</div>
                                </div>
                            </div>
                        </div>
                        <div style="height: 350px; position: relative;">
                            <canvas id="financialChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Monthly Detailed Table -->
                <div class="glass-card" style="margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-list-check" style="color: var(--secondary); font-size: 1.2rem;"></i>
                        <h3 style="margin: 0;">Bảng Tổng hợp Cân đối theo Tháng</h3>
                    </div>
                    <div class="table-container">
                        <table class="table" style="background: rgba(255,255,255,0.02);">
                            <thead>
                                <tr>
                                    <th>Tháng</th>
                                    <th style="text-align: right;">Tổng Thu</th>
                                    <th style="text-align: right;">Tổng Chi</th>
                                    <th style="text-align: right;">Lợi nhuận thực</th>
                                    <th style="text-align: right;">Tỷ lệ Chi/Thu</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    const monthly = {};
                                    trans.filter(t => t.category !== 'Luân chuyển').forEach(t => {
                                        const m = (t.date && typeof t.date === 'string') ? t.date.substring(0, 7) : '';
                                        if (!m) return;
                                        if (!monthly[m]) monthly[m] = { thu: 0, chi: 0 };
                                        monthly[m].thu += (Number(t.thu) || 0);
                                        monthly[m].chi += (Number(t.chi) || 0);
                                    });
                                    return Object.keys(monthly).sort((a,b) => b.localeCompare(a)).map(m => {
                                        const stats = monthly[m];
                                        const balance = stats.thu - stats.chi;
                                        const ratio = stats.thu > 0 ? (stats.chi / stats.thu * 100).toFixed(1) : 0;
                                        return `
                                            <tr>
                                                <td><strong>Tháng ${m.split('-').reverse().join('/')}</strong></td>
                                                <td style="text-align: right; color: var(--secondary); font-weight: 600;">${AppData.formatCurrency(stats.thu)}</td>
                                                <td style="text-align: right; color: var(--rose-light); font-weight: 600;">${AppData.formatCurrency(stats.chi)}</td>
                                                <td style="text-align: right; font-weight: 700; color: ${balance >= 0 ? 'var(--secondary)' : 'var(--rose-light)'};">
                                                    ${AppData.formatCurrency(balance)}
                                                </td>
                                                <td style="text-align: right;">
                                                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                                                        <span style="font-size: 0.8rem; color: var(--text-muted);">${ratio}%</span>
                                                        <div style="width: 60px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                                                            <div style="width: ${Math.min(ratio, 100)}%; height: 100%; background: ${ratio > 80 ? 'var(--accent)' : 'var(--primary-light)'};"></div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('');
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Entity Breakdown Section -->
                <div class="glass-card" style="margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-ship" style="color: var(--primary-light); font-size: 1.2rem;"></i>
                        <h3 style="margin: 0;">Phân bổ Thu - Chi chi tiết (Tàu & Văn phòng)</h3>
                    </div>
                    <div class="table-container" style="overflow-x: auto;">
                        <table class="table" style="font-size: 0.85rem; min-width: 1000px;">
                            <thead>
                                <tr>
                                    <th style="position: sticky; left: 0; background: #1e212b; z-index: 10;">Tháng</th>
                                    ${['VP', ...AppData.state.vessels.map(v => v.id)].map(entity => `
                                        <th style="text-align: center; border-left: 1px solid var(--border-color);">${entity}</th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    const entities = ['VP', ...AppData.state.vessels.map(v => v.id)];
                                    const breakdown = {};
                                    trans.forEach(t => {
                                        const m = (t.date && typeof t.date === 'string') ? t.date.substring(0, 7) : '';
                                        if (!m) return;
                                        
                                        // Normalize entity name
                                        let ent = t.vessel;
                                        if (ent === 'Công ty' || ent === 'Văn phòng Công ty' || ent === 'Văn phòng') ent = 'VP';
                                        else if (ent && ent.startsWith('Vũ Gia ')) ent = 'VG' + ent.split(' ')[2];
                                        else if (ent) {
                                            const v = AppData.state.vessels.find(v => v.id === ent || v.name === ent);
                                            if (v) ent = v.id;
                                        }
                                        
                                        if (!breakdown[m]) {
                                            breakdown[m] = {};
                                            entities.forEach(e => breakdown[m][e] = { thu: 0, chi: 0 });
                                        }
                                        if (breakdown[m][ent]) {
                                            breakdown[m][ent].thu += (Number(t.thu) || 0);
                                            breakdown[m][ent].chi += (Number(t.chi) || 0);
                                        }
                                    });

                                    return Object.keys(breakdown).sort((a,b) => b.localeCompare(a)).map(m => `
                                        <tr>
                                            <td style="position: sticky; left: 0; background: #1e212b; z-index: 5;"><strong>${m.split('-').reverse().join('/')}</strong></td>
                                            ${entities.map(ent => {
                                                const stats = breakdown[m][ent];
                                                const balance = stats.thu - stats.chi;
                                                return `
                                                    <td style="border-left: 1px solid var(--border-color); padding: 0.5rem;">
                                                        <div style="display: flex; flex-direction: column; gap: 2px; text-align: right;">
                                                            <div style="color: var(--secondary); font-size: 0.75rem;">+${(stats.thu / 1e6).toFixed(1)}M</div>
                                                            <div style="color: var(--rose-light); font-size: 0.75rem;">-${(stats.chi / 1e6).toFixed(1)}M</div>
                                                            <div style="font-weight: 700; color: ${balance >= 0 ? 'var(--text-main)' : 'var(--accent)'}; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 2px;">
                                                                ${(balance / 1e6).toFixed(1)}M
                                                            </div>
                                                        </div>
                                                    </td>
                                                `;
                                            }).join('')}
                                        </tr>
                                    `).join('');
                                })()}
                            </tbody>
                        </table>
                    </div>
                    <p style="margin-top: 1rem; font-size: 0.8rem; opacity: 0.6; text-align: right;">* Đơn vị tính: Triệu đồng (M)</p>
                </div>

                <div class="glass-card" style="margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fa-solid fa-list" style="color: var(--primary-light); font-size: 1.2rem;"></i>
                            <h3 style="margin: 0;">Danh sách Giao dịch</h3>
                        </div>
                    </div>
                    
                    <!-- Sleek Filter Bar -->
                    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 1.5rem; padding: 1.2rem; background: rgba(0,0,0,0.25); border-radius: var(--radius-md); border: 1px solid var(--border-color); align-items: flex-end;">
                        <div class="form-group" style="margin: 0; flex: 1; min-width: 150px;">
                            <label class="form-label" style="font-size: 0.75rem; margin-bottom: 4px; color: var(--text-muted); font-weight: 500;">Tháng hạch toán</label>
                            <select id="filter-fin-month" class="form-control" style="font-size: 0.85rem; padding: 6px 12px;" onchange="app.updateFinancialsFilters()">
                                <option value="">-- Tất cả các tháng --</option>
                                ${(() => {
                                    const months = [...new Set(trans.filter(t => t.date).map(t => t.date.substring(0, 7)))].sort().reverse();
                                    return months.map(m => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>Tháng ${m.split('-').reverse().join('/')}</option>`).join('');
                                })()}
                            </select>
                        </div>
                        <div class="form-group" style="margin: 0; flex: 1; min-width: 150px;">
                            <label class="form-label" style="font-size: 0.75rem; margin-bottom: 4px; color: var(--text-muted); font-weight: 500;">Tàu / Bộ phận</label>
                            <select id="filter-fin-vessel" class="form-control" style="font-size: 0.85rem; padding: 6px 12px;" onchange="app.updateFinancialsFilters()">
                                <option value="">-- Tất cả tàu --</option>
                                <option value="VP" ${selectedVessel === 'VP' ? 'selected' : ''}>VP (Văn phòng)</option>
                                ${AppData.state.vessels.map(v => `<option value="${v.id}" ${v.id === selectedVessel ? 'selected' : ''}>Tàu ${v.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin: 0; flex: 1; min-width: 150px;">
                            <label class="form-label" style="font-size: 0.75rem; margin-bottom: 4px; color: var(--text-muted); font-weight: 500;">Hạng mục</label>
                            <select id="filter-fin-category" class="form-control" style="font-size: 0.85rem; padding: 6px 12px;" onchange="app.updateFinancialsFilters()">
                                <option value="">-- Tất cả hạng mục --</option>
                                ${(() => {
                                    const categories = [...new Set(trans.map(t => t.category).filter(Boolean))].sort();
                                    return categories.map(c => `<option value="${c}" ${c === selectedCategory ? 'selected' : ''}>${c}</option>`).join('');
                                })()}
                            </select>
                        </div>
                        <div class="form-group" style="margin: 0; flex: 1; min-width: 150px;">
                            <label class="form-label" style="font-size: 0.75rem; margin-bottom: 4px; color: var(--text-muted); font-weight: 500;">Đối tác / NCC</label>
                            <select id="filter-fin-partner" class="form-control" style="font-size: 0.85rem; padding: 6px 12px;" onchange="app.updateFinancialsFilters()">
                                <option value="">-- Tất cả đối tác --</option>
                                ${(() => {
                                    const partners = [...new Set(trans.map(t => t.partner).filter(Boolean))].sort();
                                    return partners.map(p => `<option value="${p}" ${p === selectedPartner ? 'selected' : ''}>${p}</option>`).join('');
                                })()}
                            </select>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-outline" onclick="app.resetFinancialsFilters()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; height: 35px;" title="Reset bộ lọc">
                                <i class="fa-solid fa-arrows-rotate"></i> Reset
                            </button>
                            <button class="btn btn-outline" onclick="app.exportFinancialReport('${selectedMonth}', '${selectedVessel}', '${selectedCategory}', '${selectedPartner}')" style="padding: 0.4rem 1rem; font-size: 0.85rem; height: 35px; white-space: nowrap;">
                                <i class="fa-solid fa-file-excel" style="color: var(--secondary); margin-right: 4px;"></i> Xuất Excel
                            </button>
                        </div>
                    </div>

                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Ngày</th>
                                    <th>Tàu</th>
                                    <th>Hạng mục</th>
                                    <th>Nội dung</th>
                                    <th>Đối tác</th>
                                    <th>Nguồn tiền</th>
                                    <th>Thu</th>
                                    <th>Chi</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    let filtered = trans;
                                    if (selectedMonth) {
                                        filtered = filtered.filter(t => t.date && t.date.substring(0, 7) === selectedMonth);
                                    }
                                    if (selectedVessel) {
                                        filtered = filtered.filter(t => t.vessel === selectedVessel);
                                    }
                                    if (selectedCategory) {
                                        filtered = filtered.filter(t => t.category === selectedCategory);
                                    }
                                    if (selectedPartner) {
                                        filtered = filtered.filter(t => t.partner === selectedPartner);
                                    }
                                    if (filtered.length === 0) {
                                        return `<tr><td colspan="9" style="text-align:center; padding: 3rem; color: var(--text-muted); font-style: italic;">Không tìm thấy giao dịch nào khớp với bộ lọc.</td></tr>`;
                                    }
                                    return filtered.map(t => `
                                        <tr style="${t.category === 'Luân chuyển' ? 'opacity: 0.6; font-style: italic;' : ''}">
                                            <td>${t.date}</td>
                                            <td><span class="badge badge-outline">${t.vessel}</span></td>
                                            <td>${t.category}</td>
                                            <td>${t.content}</td>
                                            <td>${t.partner}</td>
                                            <td><small>${t.account}</small></td>
                                            <td class="value-positive">${t.thu > 0 ? AppData.formatCurrency(t.thu) : '-'}</td>
                                            <td class="value-negative">${t.chi > 0 ? AppData.formatCurrency(t.chi) : '-'}</td>
                                            <td>
                                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.editTransaction('${t.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.deleteTransaction('${t.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                            </td>
                                        </tr>
                                    `).join('');
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
        `;
    },

    loanTrackingContent: () => {
        const loans = AppData.getLoans();
        const vessels = AppData.getVessels();
        const vesselMap = {};
        vessels.forEach(v => {
            vesselMap[v.id] = v.name;
        });

        const formatShortCurrency = (amount) => {
            if (!amount) return '0';
            if (Math.abs(amount) >= 1e9) {
                return (amount / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' Tỷ';
            }
            if (Math.abs(amount) >= 1e6) {
                return (amount / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' Tr';
            }
            return AppData.formatCurrency(amount);
        };

        const today = new Date();
        today.setHours(0,0,0,0);
        
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                return dateStr.split('-').reverse().join('/');
            } catch (e) {
                return dateStr;
            }
        };

        const alerts = [];
        
        const loanItems = loans.map(l => {
            const payments = l.payments || [];
            const pPaid = payments.filter(p => p.type === 'Gốc').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const iPaid = payments.filter(p => p.type === 'Lãi').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const balance = l.isPaidOff ? 0 : Math.max(0, (Number(l.loanAmount) || 0) - pPaid);
            
            let currentPrincipalDueDate = l.principalDueDate;
            let currentInterestDueDate = l.interestDueDate;
            
            if (balance > 0) {
                const schedule = AppData.generateRepaymentSchedule(l);
                if (schedule && schedule.length > 0) {
                    let runningP = 0;
                    let runningI = 0;
                    
                    const firstUnpaidP = schedule.find(item => {
                        runningP += item.principalDue;
                        return item.principalDue > 0 && pPaid < runningP;
                    });
                    if (firstUnpaidP) {
                        currentPrincipalDueDate = firstUnpaidP.dueDate;
                    } else {
                        const lastMilestone = schedule[schedule.length - 1];
                        if (lastMilestone) currentPrincipalDueDate = lastMilestone.dueDate;
                    }
                    
                    const firstUnpaidI = schedule.find(item => {
                        runningI += item.interestDue;
                        return item.interestDue > 0 && iPaid < runningI;
                    });
                    if (firstUnpaidI) {
                        currentInterestDueDate = firstUnpaidI.dueDate;
                    } else {
                        const lastMilestone = schedule[schedule.length - 1];
                        if (lastMilestone) currentInterestDueDate = lastMilestone.dueDate;
                    }
                }
                
                let vesselDisplay = '';
                if (l.vesselId === 'MULTIPLE') {
                    const allocs = l.vesselAllocations || {};
                    const names = Object.keys(allocs).map(vId => {
                        const vName = vesselMap[vId] || vId;
                        return 'Tàu ' + vName;
                    }).join(', ');
                    vesselDisplay = `Nhiều tàu (${names || 'Chưa phân bổ'})`;
                } else {
                    vesselDisplay = l.vesselId === 'VP' ? 'Văn phòng' : 'Tàu ' + (vesselMap[l.vesselId] || l.vesselId);
                }

                if (currentPrincipalDueDate) {
                    const pDate = new Date(currentPrincipalDueDate);
                    pDate.setHours(0,0,0,0);
                    const diffP = Math.ceil((pDate - today) / (1000 * 60 * 60 * 24));
                    if (diffP <= 10) {
                        if (diffP < 0) {
                            alerts.push(`HĐ <strong>${l.contractNo}</strong> (${l.lender}) phân bổ <strong>${vesselDisplay}</strong> đã quá hạn trả gốc <strong>${Math.abs(diffP)} ngày</strong> (Hạn: ${formatDate(currentPrincipalDueDate)})`);
                        } else {
                            alerts.push(`HĐ <strong>${l.contractNo}</strong> (${l.lender}) phân bổ <strong>${vesselDisplay}</strong> sắp đến hạn trả gốc sau <strong>${diffP} ngày</strong> (Hạn: ${formatDate(currentPrincipalDueDate)})`);
                        }
                    }
                }
                if (currentInterestDueDate) {
                    const iDate = new Date(currentInterestDueDate);
                    iDate.setHours(0,0,0,0);
                    const diffI = Math.ceil((iDate - today) / (1000 * 60 * 60 * 24));
                    if (diffI <= 10) {
                        if (diffI < 0) {
                            alerts.push(`HĐ <strong>${l.contractNo}</strong> (${l.lender}) phân bổ <strong>${vesselDisplay}</strong> đã quá hạn trả lãi <strong>${Math.abs(diffI)} ngày</strong> (Hạn: ${formatDate(currentInterestDueDate)})`);
                        } else {
                            alerts.push(`HĐ <strong>${l.contractNo}</strong> (${l.lender}) phân bổ <strong>${vesselDisplay}</strong> sắp đến hạn trả lãi sau <strong>${diffI} ngày</strong> (Hạn: ${formatDate(currentInterestDueDate)})`);
                        }
                    }
                }
            }
            
            return {
                loan: l,
                balance: balance,
                pPaid: pPaid,
                iPaid: iPaid,
                principalDueDate: currentPrincipalDueDate,
                interestDueDate: currentInterestDueDate
            };
        });

        // Tách riêng theo loại hợp đồng
        const shortTermLoans = loanItems.filter(item => item.loan.type === 'Ngắn hạn');
        const mediumTermLoans = loanItems.filter(item => item.loan.type === 'Trung hạn');
        const longTermLoans = loanItems.filter(item => item.loan.type === 'Dài hạn');
        const otherLoans = loanItems.filter(item => !['Ngắn hạn', 'Trung hạn', 'Dài hạn'].includes(item.loan.type));
        if (otherLoans.length > 0) {
            longTermLoans.push(...otherLoans);
        }

        const renderCompactSummaryCard = (title, items, iconClass, colorClass) => {
            const limit = items.reduce((sum, item) => sum + (Number(item.loan.loanAmount) || 0), 0);
            const remaining = items.reduce((sum, item) => sum + item.balance, 0);
            const interestPaid = items.reduce((sum, item) => sum + item.iPaid, 0);
            const totalCount = items.length;
            const activeCount = items.filter(item => item.balance > 0).length;

            const hasOverdue = items.some(item => {
                const isOverdueP = item.principalDueDate && new Date(item.principalDueDate) < today && item.balance > 0;
                const isOverdueI = item.interestDueDate && new Date(item.interestDueDate) < today && item.balance > 0;
                return isOverdueP || isOverdueI;
            });

            return `
                <div class="glass-card" style="padding: 1rem; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.01); display: flex; flex-direction: column; gap: 0.8rem;">
                    <!-- Card Header -->
                    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <i class="${iconClass}" style="color: ${colorClass}; font-size: 1.1rem;"></i>
                            <span style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">${title}</span>
                        </div>
                        <span class="badge badge-outline" style="border-color: ${colorClass}; color: ${colorClass}; font-size: 0.7rem; padding: 2px 6px;">${totalCount} HĐ</span>
                    </div>
                    
                    <!-- KPI subgrid -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <!-- Hạn mức -->
                        <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.03); border-radius: 6px; padding: 6px 10px;" title="Tổng hạn mức giải ngân: ${AppData.formatCurrency(limit)}">
                            <div style="font-size: 0.68rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                                <i class="fa-solid fa-wallet" style="color: var(--primary-light); font-size: 0.75rem;"></i> Hạn mức
                            </div>
                            <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-main); margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                                ${formatShortCurrency(limit)}
                            </div>
                        </div>
                        
                        <!-- Dư nợ -->
                        <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.03); border-radius: 6px; padding: 6px 10px;" title="Tổng dư nợ gốc còn lại: ${AppData.formatCurrency(remaining)}">
                            <div style="font-size: 0.68rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                                <i class="fa-solid fa-file-invoice-dollar" style="color: ${hasOverdue ? 'var(--accent)' : 'var(--orange-light)'}; font-size: 0.75rem;"></i> Dư nợ
                            </div>
                            <div style="font-size: 0.95rem; font-weight: 600; color: ${hasOverdue ? 'var(--accent)' : 'var(--text-main)'}; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                                ${formatShortCurrency(remaining)}
                            </div>
                        </div>
                        
                        <!-- Lãi đã trả -->
                        <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.03); border-radius: 6px; padding: 6px 10px;" title="Tổng lãi đã trả thực tế: ${AppData.formatCurrency(interestPaid)}">
                            <div style="font-size: 0.68rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                                <i class="fa-solid fa-hand-holding-dollar" style="color: var(--secondary); font-size: 0.75rem;"></i> Lãi đã trả
                            </div>
                            <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-main); margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                                ${formatShortCurrency(interestPaid)}
                            </div>
                        </div>
                        
                        <!-- Số HĐ -->
                        <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.03); border-radius: 6px; padding: 6px 10px;" title="Số hợp đồng đang vay / Tổng số hợp đồng">
                            <div style="font-size: 0.68rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                                <i class="fa-solid fa-file-contract" style="color: var(--info); font-size: 0.75rem;"></i> Số HĐ
                            </div>
                            <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-main); margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                                ${activeCount} / ${totalCount}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };

        const renderLoanTableSection = (title, items, iconClass, colorClass) => {
            return `
                <div class="glass-card" style="margin-bottom: 2.5rem; padding: 1.5rem;">
                    <!-- Section Header -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="${iconClass}" style="color: ${colorClass}; font-size: 1.3rem;"></i>
                            <h3 style="margin: 0; color: var(--text-main); font-size: 1.2rem;">${title}</h3>
                        </div>
                        <span class="badge badge-outline" style="border-color: ${colorClass}; color: ${colorClass}; font-weight: 600;">${items.length} HĐ</span>
                    </div>
                    
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Phân bổ</th>
                                    <th>Mã HĐ</th>
                                    <th>Ngân hàng</th>
                                    <th>Loại HĐ</th>
                                    <th style="text-align: right;">Hạn mức / Dư nợ</th>
                                    <th style="text-align: center;">Lãi suất</th>
                                    <th style="text-align: center;">Ngày giải ngân</th>
                                    <th style="text-align: center;">Hạn trả gốc</th>
                                    <th style="text-align: center;">Hạn trả lãi</th>
                                    <th style="text-align: center;">Trạng thái</th>
                                    <th style="text-align: center; width: 180px;">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.length === 0 ? `
                                    <tr>
                                        <td colspan="11" style="text-align: center; padding: 3rem; color: var(--text-muted); font-style: italic;">Không có hợp đồng nào thuộc nhóm này.</td>
                                    </tr>
                                ` : items.map(item => {
                                    const l = item.loan;
                                    const isOverdueP = item.principalDueDate && new Date(item.principalDueDate) < today && item.balance > 0;
                                    const isOverdueI = item.interestDueDate && new Date(item.interestDueDate) < today && item.balance > 0;
                                    
                                    return `
                                        <tr style="${l.status === 'Đã tất toán' ? 'opacity: 0.6;' : ''}">
                                            <td style="vertical-align: top; padding-top: 12px;">
                                                ${(() => {
                                                    if (l.vesselId === 'MULTIPLE') {
                                                        const allocs = l.vesselAllocations || {};
                                                        const badges = Object.entries(allocs).map(([vId, val]) => {
                                                            const vName = vesselMap[vId] || vId;
                                                            return `<span class="badge badge-primary" style="margin: 2px; display: inline-block; white-space: nowrap;">Tàu ${vName} (${formatShortCurrency(val)})</span>`;
                                                        }).join(' ');
                                                        return badges || `<span class="badge badge-warning">Chưa phân bổ</span>`;
                                                    } else {
                                                        return `<span class="badge ${l.vesselId === 'VP' ? 'badge-outline' : 'badge-primary'}">${l.vesselId === 'VP' ? 'Văn phòng' : 'Tàu ' + (vesselMap[l.vesselId] || l.vesselId)}</span>`;
                                                    }
                                                })()}
                                            </td>
                                            <td style="vertical-align: top; padding-top: 12px;"><strong>${l.contractNo}</strong></td>
                                            <td style="vertical-align: top; padding-top: 12px;">${l.lender}</td>
                                            <td style="vertical-align: top; padding-top: 12px;">
                                                ${l.type}
                                                ${l.termYears ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${l.termYears} năm</div>` : ''}
                                            </td>
                                            <td style="text-align: right; vertical-align: top; padding-top: 12px;">
                                                <div style="font-weight: 600;">${AppData.formatCurrency(l.loanAmount)}</div>
                                                <div style="font-weight: 700; color: ${item.balance > 0 ? 'var(--rose-light)' : 'var(--secondary)'}; margin-top: 2px;">${AppData.formatCurrency(item.balance)}</div>
                                                ${(() => {
                                                    if (l.vesselId === 'MULTIPLE' && l.vesselAllocations && Object.keys(l.vesselAllocations).length > 0) {
                                                        const allocs = l.vesselAllocations || {};
                                                        const totalAllocated = Object.values(allocs).reduce((sum, val) => sum + (Number(val) || 0), 0) || l.loanAmount || 1;
                                                        const breakdowns = Object.entries(allocs).map(([vId, val]) => {
                                                            const ratio = val / totalAllocated;
                                                            const vBalance = Math.round(item.balance * ratio);
                                                            const vName = vesselMap[vId] || vId;
                                                            return `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Tàu ${vName}: ${AppData.formatCurrency(val)} / ${AppData.formatCurrency(vBalance)}</div>`;
                                                        }).join('');
                                                        return `<div style="border-top: 1px dashed rgba(255,255,255,0.06); margin-top: 6px; padding-top: 4px;">${breakdowns}</div>`;
                                                    }
                                                    return '';
                                                })()}
                                            </td>
                                            <td style="text-align: center; vertical-align: top; padding-top: 12px;">
                                                <span class="badge badge-outline" style="color: var(--secondary); border-color: var(--secondary); font-weight: 600;">${l.interestRate}</span>
                                                ${l.changedInterestRate ? `
                                                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 2px;">
                                                        Thay đổi: <strong>${l.changedInterestRate}</strong>
                                                        ${l.interestChangeDate ? `<br>(${formatDate(l.interestChangeDate)})` : ''}
                                                    </div>
                                                ` : ''}
                                            </td>
                                            <td style="text-align: center; vertical-align: top; padding-top: 12px;">${formatDate(l.disbursementDate)}</td>
                                            <td style="text-align: center; ${isOverdueP ? 'color: var(--accent); font-weight: 700;' : ''}; vertical-align: top; padding-top: 12px;">${formatDate(item.principalDueDate)}</td>
                                            <td style="text-align: center; ${isOverdueI ? 'color: var(--accent); font-weight: 700;' : ''}; vertical-align: top; padding-top: 12px;">${formatDate(item.interestDueDate)}</td>
                                            <td style="text-align: center; vertical-align: top; padding-top: 12px;">
                                                <span class="badge" style="background: ${l.status === 'Đang vay' ? 'rgba(235, 94, 85, 0.15)' : 'rgba(40, 167, 69, 0.15)'}; color: ${l.status === 'Đang vay' ? 'var(--accent)' : 'var(--secondary)'}; border: 1px solid ${l.status === 'Đang vay' ? 'var(--accent)' : 'var(--secondary)'};">
                                                    ${l.status}
                                                </span>
                                            </td>
                                            <td style="text-align: center; vertical-align: top; padding-top: 12px;">
                                                <div style="display: flex; gap: 4px; justify-content: center;">
                                                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.openLoanPaymentModal('${l.id}')" title="Trả gốc/lãi" ${l.status === 'Đã tất toán' ? 'disabled' : ''}>
                                                        <i class="fa-solid fa-hand-holding-dollar" style="color: var(--secondary);"></i>
                                                    </button>
                                                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.openLoanScheduleModal('${l.id}')" title="Kỳ phải trả & Lịch trình">
                                                        <i class="fa-solid fa-calendar-days" style="color: var(--warning);"></i>
                                                    </button>
                                                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.openLoanHistoryModal('${l.id}')" title="Lịch sử trả nợ">
                                                        <i class="fa-solid fa-clock-rotate-left" style="color: var(--info);"></i>
                                                    </button>
                                                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.openLoanModal('${l.id}')" title="Sửa">
                                                        <i class="fa-solid fa-pen" style="color: var(--info);"></i>
                                                    </button>
                                                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.deleteLoan('${l.id}')" title="Xóa">
                                                        <i class="fa-solid fa-trash" style="color: var(--accent);"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        };

        return `
            <!-- Alerts Section -->
            ${alerts.length > 0 ? `
                <div class="glass-card" style="border-left: 4px solid var(--accent); background: rgba(235, 94, 85, 0.1); margin-bottom: 2rem; padding: 1.2rem 1.5rem;">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent); font-size: 1.4rem; margin-top: 2px;"></i>
                        <div>
                            <strong style="color: var(--accent); font-size: 1.05rem; display: block; margin-bottom: 6px;">CẢNH BÁO NỢ ĐẾN HẠN (TRONG VÒNG 10 NGÀY HOẶC QUÁ HẠN)</strong>
                            <ul style="margin: 0; padding-left: 20px; font-size: 0.9rem; line-height: 1.6; color: var(--text-main);">
                                ${alerts.map(a => `<li>${a}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- Compact Summaries Row at the Top -->
            <div class="grid-3" style="margin-bottom: 2rem; gap: 15px;">
                ${renderCompactSummaryCard("Vay Ngắn hạn", shortTermLoans, "fa-solid fa-business-time", "var(--primary-light)")}
                ${renderCompactSummaryCard("Vay Trung hạn", mediumTermLoans, "fa-solid fa-clock", "var(--warning)")}
                ${renderCompactSummaryCard("Vay Dài hạn", longTermLoans, "fa-solid fa-calendar-days", "var(--secondary)")}
            </div>
            
            <!-- Loan Sections -->
            ${renderLoanTableSection("Hợp đồng Vay Ngắn hạn", shortTermLoans, "fa-solid fa-business-time", "var(--primary-light)")}
            ${renderLoanTableSection("Hợp đồng Vay Trung hạn", mediumTermLoans, "fa-solid fa-clock", "var(--warning)")}
            ${renderLoanTableSection("Hợp đồng Vay Dài hạn", longTermLoans, "fa-solid fa-calendar-days", "var(--secondary)")}
        `;
    },


    loanModal: (loan = null) => {
        const title = loan ? 'Sửa Hợp đồng Vay' : 'Thêm Hợp đồng Vay Mới';
        const vessels = AppData.getVessels();
        return `
            <div class="modal-header">
                <h3><i class="fa-solid fa-building-columns"></i> ${title}</h3>
                <button class="modal-close" onclick="app.closeModal('loan-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveLoan();">
                    <input type="hidden" id="l-id" value="${loan ? loan.id : ''}">
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Mã hợp đồng <span style="color:var(--accent)">*</span></label>
                            <input type="text" class="form-control" id="l-contractNo" value="${loan ? loan.contractNo : ''}" required placeholder="Nhập mã HĐ...">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ngân hàng cho vay <span style="color:var(--accent)">*</span></label>
                            <input type="text" class="form-control" id="l-lender" value="${loan ? loan.lender : ''}" required placeholder="Tên ngân hàng...">
                        </div>
                    </div>
                    <div class="grid-3">
                        <div class="form-group">
                            <label class="form-label">Phân bổ cho Tàu / Bộ phận <span style="color:var(--accent)">*</span></label>
                            <select class="form-control" id="l-vesselId" required onchange="app.onLoanVesselChange()">
                                <option value="">-- Chọn tàu hoặc văn phòng --</option>
                                <option value="VP" ${loan && loan.vesselId === 'VP' ? 'selected' : ''}>VP (Văn phòng)</option>
                                <option value="MULTIPLE" ${loan && loan.vesselId === 'MULTIPLE' ? 'selected' : ''}>-- Phân bổ cho nhiều tàu --</option>
                                ${vessels.map(v => `<option value="${v.id}" ${loan && loan.vesselId === v.id ? 'selected' : ''}>Tàu ${v.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Loại Hợp đồng <span style="color:var(--accent)">*</span></label>
                            <select class="form-control" id="l-type" required>
                                <option value="Ngắn hạn" ${loan && loan.type === 'Ngắn hạn' ? 'selected' : ''}>Ngắn hạn</option>
                                <option value="Trung hạn" ${loan && loan.type === 'Trung hạn' ? 'selected' : ''}>Trung hạn</option>
                                <option value="Dài hạn" ${loan && loan.type === 'Dài hạn' ? 'selected' : ''}>Dài hạn</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Số năm vay</label>
                            <input type="number" step="any" class="form-control" id="l-termYears" value="${loan ? (loan.termYears || '') : ''}" placeholder="VD: 5">
                        </div>
                    </div>
                    
                    ${(() => {
                        const allocs = loan && loan.vesselAllocations ? loan.vesselAllocations : {};
                        return `
                        <div class="form-group" id="l-multiple-vessels-container" style="display: ${loan && loan.vesselId === 'MULTIPLE' ? 'block' : 'none'}; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; margin-top: -0.5rem; margin-bottom: 1rem;">
                            <label class="form-label" style="margin-bottom: 0.75rem; display: block; font-weight: 600; color: var(--primary-light);">Nhập số tiền phân bổ cho từng tàu:</label>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
                                ${vessels.map(v => {
                                    const hasAlloc = allocs[v.id] !== undefined;
                                    const allocVal = hasAlloc ? allocs[v.id] : '';
                                    return `
                                        <div style="display: flex; flex-direction: column; gap: 4px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
                                            <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; margin: 0; user-select: none; color: var(--text-main);">
                                                <input type="checkbox" class="l-vessel-checkbox" data-vessel-id="${v.id}" ${hasAlloc ? 'checked' : ''} onchange="app.toggleVesselAllocation('${v.id}')" style="width: 16px; height: 16px; cursor: pointer;">
                                                Tàu ${v.name}
                                            </label>
                                            <input type="number" class="form-control l-vessel-alloc-input" id="l-alloc-${v.id}" value="${allocVal}" placeholder="Số tiền (VND)" style="display: ${hasAlloc ? 'block' : 'none'}; margin-top: 6px;" oninput="app.calculateTotalAllocation()">
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            <div style="margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px dashed rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem;">
                                <div>Tổng số tiền phân bổ: <strong id="l-total-alloc-display" style="color: var(--secondary); font-weight: 700;">0</strong> VND</div>
                                <div>Chưa phân bổ: <strong id="l-unalloc-display" style="color: var(--warning); font-weight: 700;">0</strong> VND</div>
                            </div>
                        </div>
                        `;
                    })()}
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Kỳ trả nợ Gốc <span style="color:var(--accent)">*</span></label>
                            <select class="form-control" id="l-principalPeriod" required>
                                <option value="monthly" ${loan && loan.principalPeriod === 'monthly' ? 'selected' : ''}>Hàng tháng</option>
                                <option value="quarterly" ${!loan || loan.principalPeriod === 'quarterly' ? 'selected' : ''}>Hàng quý (Mặc định)</option>
                                <option value="half-yearly" ${loan && loan.principalPeriod === 'half-yearly' ? 'selected' : ''}>Hàng 6 tháng</option>
                                <option value="yearly" ${loan && loan.principalPeriod === 'yearly' ? 'selected' : ''}>Hàng năm</option>
                                <option value="end-of-term" ${loan && loan.principalPeriod === 'end-of-term' ? 'selected' : ''}>Cuối kỳ tất toán</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kỳ trả nợ Lãi <span style="color:var(--accent)">*</span></label>
                            <select class="form-control" id="l-interestPeriod" required>
                                <option value="monthly" ${!loan || loan.interestPeriod === 'monthly' ? 'selected' : ''}>Hàng tháng (Mặc định)</option>
                                <option value="quarterly" ${loan && loan.interestPeriod === 'quarterly' ? 'selected' : ''}>Hàng quý</option>
                                <option value="half-yearly" ${loan && loan.interestPeriod === 'half-yearly' ? 'selected' : ''}>Hàng 6 tháng</option>
                                <option value="yearly" ${loan && loan.interestPeriod === 'yearly' ? 'selected' : ''}>Hàng năm</option>
                                <option value="end-of-term" ${loan && loan.interestPeriod === 'end-of-term' ? 'selected' : ''}>Cuối kỳ tất toán</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid-2" style="border-top: 1px dashed rgba(255,255,255,0.1); margin-top: 0.5rem; padding-top: 1rem;">
                        <div class="form-group">
                            <label class="form-label" style="display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-clock" style="color: var(--warning);"></i>
                                Số tháng ân hạn gốc
                                <span style="font-weight: 400; font-size: 0.8rem; color: var(--text-muted);">(Thời gian đầu chỉ trả lãi)</span>
                            </label>
                            <input type="number" min="0" step="1" class="form-control" id="l-gracePeriodMonths" value="${loan ? (loan.gracePeriodMonths || 0) : 0}" placeholder="0 = không có ân hạn">
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-money-bill-wave" style="color: var(--secondary);"></i>
                                Tiền gốc trả cố định mỗi kỳ (VND)
                                <span style="font-weight: 400; font-size: 0.8rem; color: var(--text-muted);">(Để trống nếu tự động chia đều)</span>
                            </label>
                            <input type="number" min="0" step="any" class="form-control" id="l-fixedPrincipalAmount" value="${loan && loan.fixedPrincipalAmount ? loan.fixedPrincipalAmount : ''}" placeholder="Nhập số tiền gốc trả cố định...">
                        </div>
                    </div>
                    <div style="background: rgba(255,200,50,0.07); border: 1px solid rgba(255,200,50,0.2); border-radius: 6px; padding: 10px; font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1rem;">
                        <i class="fa-solid fa-circle-info" style="color: var(--warning); margin-right: 4px;"></i>
                        <strong style="color: var(--warning);">Lưu ý:</strong> Ngày trả mỗi kỳ sẽ dùng <strong>ngày</strong> lấy từ trường <em>Hạn trả gốc</em> và <em>Hạn trả lãi</em> bên dưới. Vui lòng nhập chính xác ngày của tháng (VD: 20/01/2025).
                    </div>
                    <div class="grid-3">
                        <div class="form-group">
                            <label class="form-label">Số tiền vay (VND) <span style="color:var(--accent)">*</span></label>
                            <input type="number" step="any" class="form-control" id="l-loanAmount" value="${loan ? loan.loanAmount : ''}" required placeholder="Nhập số tiền...">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Lãi suất ban đầu <span style="color:var(--accent)">*</span></label>
                            <input type="text" class="form-control" id="l-interestRate" value="${loan ? loan.interestRate : ''}" required placeholder="VD: 7.5%/năm">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Trạng thái <span style="color:var(--accent)">*</span></label>
                            <select class="form-control" id="l-status" required onchange="document.getElementById('l-isPaidOff').checked = (this.value === 'Đã tất toán');">
                                <option value="Đang vay" ${loan && loan.status === 'Đang vay' ? 'selected' : ''}>Đang vay</option>
                                <option value="Đã tất toán" ${loan && loan.status === 'Đã tất toán' ? 'selected' : ''}>Đã tất toán</option>
                            </select>
                        </div>
                    </div>
                    <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px; background: rgba(0,255,100,0.05); padding: 10px; border-radius: 6px; border: 1px solid rgba(0,255,100,0.15);">
                        <input type="checkbox" id="l-isPaidOff" ${loan && loan.isPaidOff ? 'checked' : ''} onchange="document.getElementById('l-status').value = this.checked ? 'Đã tất toán' : 'Đang vay';" style="width: 18px; height: 18px; cursor: pointer;">
                        <label for="l-isPaidOff" style="cursor: pointer; font-weight: 600; color: var(--secondary); margin: 0; font-size: 0.9rem;">
                            Đã trả đủ gốc, lãi (Hệ thống tự động đưa Dư nợ gốc về 0 và chuyển trạng thái Đã tất toán)
                        </label>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Ngày thay đổi lãi suất</label>
                            <input type="date" class="form-control" id="l-interestChangeDate" value="${loan ? (loan.interestChangeDate || '') : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Lãi suất thay đổi</label>
                            <input type="text" class="form-control" id="l-changedInterestRate" value="${loan ? (loan.changedInterestRate || '') : ''}" placeholder="VD: 8.5%/năm">
                        </div>
                    </div>
                    <div class="grid-3">
                        <div class="form-group">
                            <label class="form-label">Ngày giải ngân <span style="color:var(--accent)">*</span></label>
                            <input type="date" class="form-control" id="l-disbursementDate" value="${loan ? loan.disbursementDate : ''}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hạn trả gốc tiếp theo <span style="color:var(--accent)">*</span></label>
                            <input type="date" class="form-control" id="l-principalDueDate" value="${loan ? loan.principalDueDate : ''}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hạn trả lãi tiếp theo <span style="color:var(--accent)">*</span></label>
                            <input type="date" class="form-control" id="l-interestDueDate" value="${loan ? loan.interestDueDate : ''}" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <input type="text" class="form-control" id="l-note" value="${loan ? (loan.note || '') : ''}" placeholder="Ghi chú khác...">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="app.closeModal('loan-modal')">Hủy</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Lưu</button>
                    </div>
                </form>
            </div>
        `;
    },

    loanPaymentModal: (loan) => {
        return `
            <div class="modal-header">
                <h3><i class="fa-solid fa-hand-holding-dollar"></i> Thanh toán nợ - HĐ: ${loan.contractNo}</h3>
                <button class="modal-close" onclick="app.closeModal('loan-payment-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveLoanPayment();">
                    <input type="hidden" id="lp-loanId" value="${loan.id}">
                    <div class="form-group">
                        <label class="form-label">Ngày thanh toán <span style="color:var(--accent)">*</span></label>
                        <input type="date" class="form-control" id="lp-date" value="${new Date().toISOString().substring(0, 10)}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Loại thanh toán <span style="color:var(--accent)">*</span></label>
                        <select class="form-control" id="lp-type" required>
                            <option value="Gốc">Trả nợ gốc</option>
                            <option value="Lãi">Trả tiền lãi</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Số tiền thanh toán (VND) <span style="color:var(--accent)">*</span></label>
                        <input type="number" step="any" class="form-control" id="lp-amount" required placeholder="Nhập số tiền...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <input type="text" class="form-control" id="lp-note" placeholder="Nhập ghi chú...">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="app.closeModal('loan-payment-modal')">Hủy</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Xác nhận</button>
                    </div>
                </form>
            </div>
        `;
    },

    loanHistoryModal: (loan) => {
        const payments = loan.payments || [];
        const principalPaid = payments.filter(p => p.type === 'Gốc').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const interestPaid = payments.filter(p => p.type === 'Lãi').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                return dateStr.split('-').reverse().join('/');
            } catch (e) {
                return dateStr;
            }
        };

        return `
            <div class="modal-header">
                <h3><i class="fa-solid fa-clock-rotate-left"></i> Lịch sử trả nợ - HĐ: ${loan.contractNo}</h3>
                <button class="modal-close" onclick="app.closeModal('loan-history-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="grid-3" style="margin-bottom: 1.5rem; gap: 15px;">
                    <div class="glass-card" style="padding: 1rem; text-align: center;">
                        <div class="stat-value" style="font-size: 1.1rem; color: var(--primary-light);">${AppData.formatCurrency(loan.loanAmount)}</div>
                        <div class="stat-label" style="font-size: 0.8rem;">Hạn mức vay ban đầu</div>
                    </div>
                    <div class="glass-card" style="padding: 1rem; text-align: center;">
                        <div class="stat-value" style="font-size: 1.1rem; color: var(--secondary);">${AppData.formatCurrency(principalPaid)}</div>
                        <div class="stat-label" style="font-size: 0.8rem;">Đã trả gốc</div>
                    </div>
                    <div class="glass-card" style="padding: 1rem; text-align: center;">
                        <div class="stat-value" style="font-size: 1.1rem; color: var(--info);">${AppData.formatCurrency(interestPaid)}</div>
                        <div class="stat-label" style="font-size: 0.8rem;">Đã trả lãi</div>
                    </div>
                </div>
                
                <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-list" style="margin-right: 5px;"></i>Danh sách các đợt thanh toán</h4>
                <div class="table-container" style="max-height: 300px; overflow-y: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Ngày</th>
                                <th>Phân loại</th>
                                <th style="text-align: right;">Số tiền</th>
                                <th>Ghi chú</th>
                                <th style="text-align: center;">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.length === 0 ? `
                                <tr>
                                    <td colspan="5" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 2rem;">Chưa ghi nhận đợt thanh toán nào.</td>
                                </tr>
                            ` : payments.map(p => `
                                <tr>
                                    <td>${formatDate(p.date)}</td>
                                    <td>
                                        <span class="badge" style="background: ${p.type === 'Gốc' ? 'rgba(40, 167, 69, 0.15)' : 'rgba(23, 162, 184, 0.15)'}; color: ${p.type === 'Gốc' ? 'var(--secondary)' : 'var(--info)'}; border: 1px solid ${p.type === 'Gốc' ? 'var(--secondary)' : 'var(--info)'};">
                                            ${p.type === 'Gốc' ? 'Trả Gốc' : 'Trả Lãi'}
                                        </span>
                                    </td>
                                    <td style="text-align: right; font-weight: 600; color: ${p.type === 'Gốc' ? 'var(--secondary)' : 'var(--text-main)'};">${AppData.formatCurrency(p.amount)}</td>
                                    <td>${p.note || ''}</td>
                                    <td style="text-align: center;">
                                        <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.deleteLoanPayment('${loan.id}', '${p.id}')" title="Xóa đợt thanh toán">
                                            <i class="fa-solid fa-trash" style="color: var(--accent);"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="app.closeModal('loan-history-modal')">Đóng</button>
            </div>
        `;
    },

    loanScheduleModal: (loan) => {
        const schedule = AppData.generateRepaymentSchedule(loan);
        const payments = loan.payments || [];
        const actualPrincipalPaid = payments.filter(p => p.type === 'Gốc').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const actualInterestPaid = payments.filter(p => p.type === 'Lãi').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const vessels = AppData.getVessels();
        const vesselMap = {};
        vessels.forEach(v => {
            vesselMap[v.id] = v.name;
        });

        const allocs = loan.vesselAllocations || {};
        const totalAllocated = Object.values(allocs).reduce((sum, val) => sum + (Number(val) || 0), 0) || loan.loanAmount || 1;

        const today = new Date();
        today.setHours(0,0,0,0);
        const todayStr = AppData.formatDateLocal(today);

        let scheduledPrincipalDueUpToToday = 0;
        let scheduledInterestDueUpToToday = 0;

        schedule.forEach(item => {
            if (item.dueDate <= todayStr) {
                scheduledPrincipalDueUpToToday += item.principalDue;
                scheduledInterestDueUpToToday += item.interestDue;
            }
        });

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                return dateStr.split('-').reverse().join('/');
            } catch (e) {
                return dateStr;
            }
        };

        let runningScheduledPrincipal = 0;
        let runningScheduledInterest = 0;

        const tableRows = schedule.map((item, index) => {
            runningScheduledPrincipal += item.principalDue;
            runningScheduledInterest += item.interestDue;

            const isPrincipalPaid = item.principalDue === 0 ? true : actualPrincipalPaid >= runningScheduledPrincipal;
            const isInterestPaid = actualInterestPaid >= runningScheduledInterest;
            const isFuture = item.dueDate > todayStr;
            const isGrace = item.isGracePeriod;

            let statusText = '';
            let statusStyle = '';
            if (isGrace) {
                if (isInterestPaid) {
                    statusText = 'Đã trả lãi';
                    statusStyle = 'background: rgba(40,167,69,0.15); color: var(--secondary); border: 1px solid var(--secondary);';
                } else if (isFuture) {
                    statusText = 'Ân hạn gốc';
                    statusStyle = 'background: rgba(255,200,50,0.12); color: var(--warning); border: 1px solid var(--warning);';
                } else {
                    statusText = 'Chưa trả lãi';
                    statusStyle = 'background: rgba(235,94,85,0.15); color: var(--accent); border: 1px solid var(--accent);';
                }
            } else if (isPrincipalPaid && isInterestPaid) {
                statusText = 'Đã trả đủ';
                statusStyle = 'background: rgba(40, 167, 69, 0.15); color: var(--secondary); border: 1px solid var(--secondary);';
            } else if (isFuture) {
                statusText = 'Trong hạn';
                statusStyle = 'background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid var(--border-color);';
            } else {
                statusText = 'Chưa trả đủ';
                statusStyle = 'background: rgba(235, 94, 85, 0.15); color: var(--accent); border: 1px solid var(--accent);';
            }

            const rowStyle = isGrace
                ? 'background: rgba(255,200,50,0.04); border-left: 2px solid rgba(255,200,50,0.4);'
                : (isPrincipalPaid && isInterestPaid ? 'opacity: 0.75;' : '');

            let principalCell = '';
            if (isGrace) {
                principalCell = `<span style="color: var(--warning); font-size: 0.75rem;">Ân hạn</span>`;
            } else {
                principalCell = `<div>${AppData.formatCurrency(item.principalDue)}</div>`;
                if (loan.vesselId === 'MULTIPLE' && Object.keys(allocs).length > 0) {
                    const breakdown = Object.entries(allocs).map(([vId, val]) => {
                        const ratio = val / totalAllocated;
                        const vPrincipal = Math.round(item.principalDue * ratio);
                        const vName = vesselMap[vId] || vId;
                        return `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 1px;">Tàu ${vName}: ${AppData.formatCurrency(vPrincipal)}</div>`;
                    }).join('');
                    principalCell += `<div style="border-top: 1px dashed rgba(255,255,255,0.06); margin-top: 4px; padding-top: 2px;">${breakdown}</div>`;
                }
            }

            let interestCell = `<div>${AppData.formatCurrency(item.interestDue)}</div>`;
            if (loan.vesselId === 'MULTIPLE' && Object.keys(allocs).length > 0) {
                const breakdown = Object.entries(allocs).map(([vId, val]) => {
                    const ratio = val / totalAllocated;
                    const vInterest = Math.round(item.interestDue * ratio);
                    const vName = vesselMap[vId] || vId;
                    return `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 1px;">Tàu ${vName}: ${AppData.formatCurrency(vInterest)}</div>`;
                }).join('');
                interestCell += `<div style="border-top: 1px dashed rgba(255,255,255,0.06); margin-top: 4px; padding-top: 2px;">${breakdown}</div>`;
            }

            let totalCell = `<div>${AppData.formatCurrency(item.totalDue)}</div>`;
            if (loan.vesselId === 'MULTIPLE' && Object.keys(allocs).length > 0) {
                const breakdown = Object.entries(allocs).map(([vId, val]) => {
                    const ratio = val / totalAllocated;
                    const vTotal = Math.round(item.totalDue * ratio);
                    const vName = vesselMap[vId] || vId;
                    return `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 1px;">Tàu ${vName}: ${AppData.formatCurrency(vTotal)}</div>`;
                }).join('');
                totalCell += `<div style="border-top: 1px dashed rgba(255,255,255,0.06); margin-top: 4px; padding-top: 2px;">${breakdown}</div>`;
            }

            let balanceCell = `<div>${AppData.formatCurrency(item.balanceAfter)}</div>`;
            if (loan.vesselId === 'MULTIPLE' && Object.keys(allocs).length > 0) {
                const breakdown = Object.entries(allocs).map(([vId, val]) => {
                    const ratio = val / totalAllocated;
                    const vBalance = Math.round(item.balanceAfter * ratio);
                    const vName = vesselMap[vId] || vId;
                    return `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 1px;">Tàu ${vName}: ${AppData.formatCurrency(vBalance)}</div>`;
                }).join('');
                balanceCell += `<div style="border-top: 1px dashed rgba(255,255,255,0.06); margin-top: 4px; padding-top: 2px;">${breakdown}</div>`;
            }

            return `
                <tr style="${rowStyle}">
                    <td style="text-align: center; vertical-align: top; padding-top: 12px;">${index + 1}</td>
                    <td style="text-align: center; font-weight: 500; vertical-align: top; padding-top: 12px;">${formatDate(item.dueDate)}</td>
                    <td style="text-align: center; font-weight: 500; color: var(--text-main); vertical-align: top; padding-top: 12px;">${item.actualDays || 0}</td>
                    <td style="text-align: right; font-weight: 500; vertical-align: top; padding-top: 12px;">${principalCell}</td>
                    <td style="text-align: right; font-weight: 500; vertical-align: top; padding-top: 12px;">${interestCell}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--info); vertical-align: top; padding-top: 12px;">${totalCell}</td>
                    <td style="text-align: right; font-weight: 500; opacity: 0.8; vertical-align: top; padding-top: 12px;">${balanceCell}</td>
                    <td style="text-align: center; vertical-align: top; padding-top: 12px;">
                        <span class="badge" style="${statusStyle}">
                            ${statusText}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="modal-header">
                <h3><i class="fa-solid fa-calendar-days"></i> Lịch trình thanh toán - HĐ: ${loan.contractNo}</h3>
                <button class="modal-close" onclick="app.closeModal('loan-schedule-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <div style="background: rgba(0,0,0,0.2); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <strong style="color: var(--secondary); font-size: 1rem; display: block; margin-bottom: 4px;">TỰ ĐỘNG THẦN TỐC CẬP NHẬT TRẢ NỢ ĐẾN NAY</strong>
                        <span style="font-size: 0.82rem; color: var(--text-muted); display: block; max-width: 600px;">
                            Nếu bạn vẫn trả gốc lãi đều đặn đúng hạn đến hôm nay, nhấn nút bên phải để hệ thống tự động ghi nhận các khoản trả nợ gốc và lãi lũy kế tương ứng từ ngày giải ngân đến hiện tại.
                        </span>
                    </div>
                    <button class="btn btn-primary" onclick="app.autoPayLoanUpToToday('${loan.id}')" style="background: var(--secondary); border-color: var(--secondary); white-space: nowrap;">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Đã trả đủ gốc, lãi đến nay
                    </button>
                </div>

                <div class="grid-4" style="margin-bottom: 1.5rem; gap: 15px;">
                    <div class="glass-card" style="padding: 0.8rem; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div class="stat-value" style="font-size: 1.05rem; color: var(--text-main);">${AppData.formatCurrency(scheduledPrincipalDueUpToToday)}</div>
                            <div class="stat-label" style="font-size: 0.75rem;">Gốc phải trả đến nay</div>
                        </div>
                        ${loan.vesselId === 'MULTIPLE' && Object.keys(allocs).length > 0 ? `
                            <div style="font-size: 0.72rem; color: var(--text-muted); border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 4px; margin-top: 6px; text-align: left; display: block;">
                                ${Object.entries(allocs).map(([vId, val]) => `<div>Tàu ${(vesselMap[vId] || vId)}: ${AppData.formatCurrency(Math.round(scheduledPrincipalDueUpToToday * (val / totalAllocated)))}</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="glass-card" style="padding: 0.8rem; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div class="stat-value" style="font-size: 1.05rem; color: var(--text-main);">${AppData.formatCurrency(scheduledInterestDueUpToToday)}</div>
                            <div class="stat-label" style="font-size: 0.75rem;">Lãi phải trả đến nay</div>
                        </div>
                        ${loan.vesselId === 'MULTIPLE' && Object.keys(allocs).length > 0 ? `
                            <div style="font-size: 0.72rem; color: var(--text-muted); border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 4px; margin-top: 6px; text-align: left; display: block;">
                                ${Object.entries(allocs).map(([vId, val]) => `<div>Tàu ${(vesselMap[vId] || vId)}: ${AppData.formatCurrency(Math.round(scheduledInterestDueUpToToday * (val / totalAllocated)))}</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="glass-card" style="padding: 0.8rem; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div class="stat-value" style="font-size: 1.05rem; color: var(--secondary);">${AppData.formatCurrency(actualPrincipalPaid)}</div>
                            <div class="stat-label" style="font-size: 0.75rem;">Gốc đã trả thực tế</div>
                        </div>
                        ${loan.vesselId === 'MULTIPLE' && Object.keys(allocs).length > 0 ? `
                            <div style="font-size: 0.72rem; color: var(--text-muted); border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 4px; margin-top: 6px; text-align: left; display: block;">
                                ${Object.entries(allocs).map(([vId, val]) => `<div>Tàu ${(vesselMap[vId] || vId)}: ${AppData.formatCurrency(Math.round(actualPrincipalPaid * (val / totalAllocated)))}</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="glass-card" style="padding: 0.8rem; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div class="stat-value" style="font-size: 1.05rem; color: var(--info);">${AppData.formatCurrency(actualInterestPaid)}</div>
                            <div class="stat-label" style="font-size: 0.75rem;">Lãi đã trả thực tế</div>
                        </div>
                        ${loan.vesselId === 'MULTIPLE' && Object.keys(allocs).length > 0 ? `
                            <div style="font-size: 0.72rem; color: var(--text-muted); border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 4px; margin-top: 6px; text-align: left; display: block;">
                                ${Object.entries(allocs).map(([vId, val]) => `<div>Tàu ${(vesselMap[vId] || vId)}: ${AppData.formatCurrency(Math.round(actualInterestPaid * (val / totalAllocated)))}</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>

                ${loan.gracePeriodMonths > 0 ? `
                <div style="display:flex; align-items:center; gap:10px; padding: 0.6rem 1rem; background: rgba(255,200,50,0.07); border: 1px solid rgba(255,200,50,0.25); border-radius: var(--radius-md); margin-bottom: 1rem; font-size:0.85rem;">
                    <i class="fa-solid fa-hourglass-half" style="color:var(--warning);"></i>
                    <span><strong style="color:var(--warning);">Ân hạn gốc: ${loan.gracePeriodMonths} tháng</strong> đầu — trong thời gian này chỉ phải trả <strong>lãi</strong>, chưa trả gốc. Các hàng màu vàng nhạt là kỳ ân hạn.</span>
                </div>` : ''}

                ${loan.fixedPrincipalAmount > 0 ? `
                <div style="display:flex; align-items:center; gap:10px; padding: 0.6rem 1rem; background: rgba(0,255,100,0.05); border: 1px solid rgba(0,255,100,0.15); border-radius: var(--radius-md); margin-bottom: 1rem; font-size:0.85rem;">
                    <i class="fa-solid fa-circle-check" style="color:var(--secondary);"></i>
                    <span><strong style="color:var(--secondary);">Gốc trả cố định:</strong> Trả gốc cố định <strong>${AppData.formatCurrency(loan.fixedPrincipalAmount)} VND</strong> mỗi kỳ (đến khi trả hết dư nợ).</span>
                </div>` : ''}

                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom: 0.8rem;">
                    <h4 style="margin:0; display:flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-list-ol"></i> Chi tiết các kỳ thanh toán theo kế hoạch
                    </h4>
                    <div style="display:flex; align-items:center; gap:10px; font-size:0.78rem; color:var(--text-muted);">
                        <span><span style="display:inline-block;width:10px;height:10px;background:rgba(40,167,69,0.4);border-radius:2px;margin-right:4px;"></span>Đã trả đủ</span>
                        <span><span style="display:inline-block;width:10px;height:10px;background:rgba(255,200,50,0.3);border-radius:2px;margin-right:4px;"></span>Ân hạn gốc</span>
                        <span><span style="display:inline-block;width:10px;height:10px;background:rgba(235,94,85,0.3);border-radius:2px;margin-right:4px;"></span>Chưa trả đủ</span>
                        <span><span style="display:inline-block;width:10px;height:10px;background:rgba(255,255,255,0.06);border-radius:2px;margin-right:4px;"></span>Trong hạn</span>
                    </div>
                </div>
                <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th style="text-align: center; width: 60px;">Kỳ thứ</th>
                                <th style="text-align: center; width: 110px;">Hạn trả</th>
                                <th style="text-align: center; width: 80px;">Số ngày</th>
                                <th style="text-align: right;">Gốc phải trả</th>
                                <th style="text-align: right;">Lãi phải trả</th>
                                <th style="text-align: right;">Tổng cộng kỳ</th>
                                <th style="text-align: right;">Dư nợ gốc còn lại</th>
                                <th style="text-align: center; width: 120px;">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows.length === 0 ? `
                                <tr>
                                    <td colspan="8" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 2rem;">Không tạo được lịch trình. Vui lòng kiểm tra lại ngày giải ngân và số năm vay.</td>
                                </tr>
                            ` : tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="app.closeModal('loan-schedule-modal')">Đóng</button>
            </div>
        `;
    },

    transModal: () => {
        return `
            <div class="modal-header"><h3>Thêm Giao Dịch</h3><button class="modal-close" onclick="app.closeModal('trans-modal')">&times;</button></div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveTransaction();">
                    <input type="hidden" id="t-id">
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Ngày</label><input type="date" class="form-control" id="t-date" required></div>
                        <div class="form-group">
                            <label class="form-label">Tên tàu</label>
                            <select class="form-control" id="t-vessel" onchange="app.onTransactionCatChange()">
                                <option value="VP">VP</option>
                                ${AppData.state.vessels.map(v => `<option value="${v.id}">${v.id}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Hạng mục</label><select class="form-control" id="t-cat" required onchange="app.onTransactionCatChange()">
    <option value="">-- Chọn Hạng mục --</option>
    <option value="4.Dầu DO">4. Dầu DO</option>
    <option value="1.Tàu Ứng">1. Tàu Ứng</option>
    <option value="CVC">CVC</option>
    <option value="2.Chi Phí Cảng">2. Chi Phí Cảng</option>
    <option value="9.Vật Tư">9. Vật Tư</option>
    <option value="3.Lương">3. Lương</option>
    <option value="6.Lãi Vay">6. Lãi Vay</option>
    <option value="Trả gốc vay">Trả gốc vay</option>
    <option value="7.Bảo Hiểm">7. Bảo Hiểm</option>
    <option value="5.Dầu LO">5. Dầu LO</option>
    <option value="Vật tư sửa chữa trung gian">Vật tư sửa chữa trung gian</option>
    <option value="Vật tư sửa chữa định kỳ">Vật tư sửa chữa định kỳ</option>
    <option value="Vật tư sửa chữa lớn">Vật tư sửa chữa lớn</option>
    <option value="Luân chuyển">Luân chuyển</option>
    <option value="Văn phòng">Văn phòng</option>
</select></div>
                        <div class="form-group">
                            <label class="form-label">Đối tác</label>
                            <input type="text" class="form-control" id="t-partner" list="trans-partner-list" placeholder="Chọn hoặc nhập..." required>
                            <datalist id="trans-partner-list">
                                ${(() => {
                                    const list = [...AppData.getVendors(), ...AppData.getCustomers()];
                                    const uniqueNames = Array.from(new Set(list.map(p => p.name).filter(Boolean))).sort();
                                    return uniqueNames.map(name => `<option value="${name}"></option>`).join('');
                                })()}
                            </datalist>
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Số chuyến</label>
                            <input type="text" class="form-control" id="t-voyage" placeholder="VD: C1, C2... (để trống nếu chi phí tháng)">
                        </div>
                        <div class="form-group" id="t-contract-wrapper" style="display: none;">
                            <label class="form-label">Mã HĐ (Chỉ áp dụng CVC)</label>
                            <select class="form-control" id="t-contract">
                                <option value="">-- Chọn Mã HĐ --</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group"><label class="form-label">Nội dung chi tiết</label><textarea class="form-control" id="t-content" required></textarea></div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Khoản Thu (VND)</label><input type="number" step="any" class="form-control" id="t-thu" value="0"></div>
                        <div class="form-group"><label class="form-label">Khoản Chi (VND)</label><input type="number" step="any" class="form-control" id="t-chi" value="0"></div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tài khoản thanh toán</label>
                        <select class="form-control" id="t-acc">
                            <option value="Tiền mặt">Tiền mặt</option>
                            <option value="ABbank">ABbank</option>
                            <option value="Viettinbank">Viettinbank</option>
                            <option value="Tài khoản cá nhân">Tài khoản cá nhân</option>
                        </select>
                    </div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary">Lưu Giao Dịch</button></div>
                </form>
            </div>
        `;
    },

    fuel: (vesselId, activeTab = 'DO') => {
        const vessels = AppData.getVessels();
        const selectedVesselId = vesselId || (vessels[0] ? vessels[0].id : '');
        const selectedVessel = AppData.getVessel(selectedVesselId);

        if (activeTab === 'LO') {
            const loSupplies = AppData.getLOSupplies(selectedVesselId);
            
            // Default config values from vessel
            const loHours = selectedVessel.loHours !== undefined ? selectedVessel.loHours : 800;
            const loRepl = selectedVessel.loReplacementQty !== undefined ? selectedVessel.loReplacementQty : 8;
            const loTopup = selectedVessel.loTopupQty !== undefined ? selectedVessel.loTopupQty : 3;
            const totalLO = Number(loRepl) + Number(loTopup);
            const hourlyRate = loHours > 0 ? (totalLO / loHours) : 0;
            
            // Calculate LO oil statistics from C1 onwards
            const getVoyageNumber = (voyNo) => {
                if (!voyNo) return 0;
                const match = String(voyNo).match(/\d+/);
                return match ? parseInt(match[0], 10) : 0;
            };
            const shipments = AppData.getShipments().filter(s => s.vesselId === selectedVesselId);
            const loShipments = shipments.filter(s => getVoyageNumber(s.voyageNo) >= 1);
            const totalHours = loShipments.reduce((sum, s) => sum + (Number(s.fuelHours) || 0), 0);
            const totalSupplied = loSupplies.reduce((sum, s) => sum + (Number(s.qty) || 0), 0);
            const totalConsumed = totalHours * hourlyRate;
            const remaining = totalSupplied - totalConsumed;
            
            return `
                <div class="view-section">
                    <div class="page-header">
                        <div>
                            <h1 class="page-title">Quản lý Nhiên liệu (Dầu LO)</h1>
                            <p class="page-subtitle">Cấu hình định mức & lịch sử cấp Dầu LO cho tàu ${selectedVessel.name}</p>
                        </div>
                        <div style="display:flex; gap:1rem;">
                            <select class="form-control" onchange="app.navigate('fuel', this.value, 'LO')" style="width:auto;">
                                ${vessels.map(v => `<option value="${v.id}" ${v.id === selectedVesselId ? 'selected' : ''}>${v.id}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="tabs" style="display:flex; gap:10px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">
                        <button class="btn btn-outline" onclick="app.navigate('fuel', '${selectedVesselId}', 'DO')">
                            <i class="fa-solid fa-gas-pump"></i> Dầu DO
                        </button>
                        <button class="btn btn-primary" onclick="app.navigate('fuel', '${selectedVesselId}', 'LO')">
                            <i class="fa-solid fa-oil-can"></i> Dầu LO (Lube Oil)
                        </button>
                    </div>

                    <!-- LO Statistics KPI Grid -->
                    <div class="kpi-grid" style="margin-bottom: 2rem;">
                        <div class="kpi-card kpi-info">
                            <div class="kpi-details">
                                <span class="kpi-title">Tổng giờ chạy (từ C1)</span>
                                <span class="kpi-value">${totalHours.toLocaleString('vi-VN', {maximumFractionDigits: 1})} h</span>
                            </div>
                            <div class="kpi-icon-wrapper"><i class="fa-solid fa-clock"></i></div>
                        </div>
                        <div class="kpi-card kpi-primary">
                            <div class="kpi-details">
                                <span class="kpi-title">Tổng LO đã cấp</span>
                                <span class="kpi-value">${totalSupplied.toLocaleString('vi-VN', {maximumFractionDigits: 1})} fi</span>
                            </div>
                            <div class="kpi-icon-wrapper"><i class="fa-solid fa-truck-field"></i></div>
                        </div>
                        <div class="kpi-card kpi-danger">
                            <div class="kpi-details">
                                <span class="kpi-title">Tổng LO đã dùng</span>
                                <span class="kpi-value">${totalConsumed.toLocaleString('vi-VN', {maximumFractionDigits: 1})} fi</span>
                            </div>
                            <div class="kpi-icon-wrapper"><i class="fa-solid fa-oil-can"></i></div>
                        </div>
                        <div class="kpi-card kpi-success">
                            <div class="kpi-details">
                                <span class="kpi-title">Lượng LO còn lại</span>
                                <span class="kpi-value" style="color: ${remaining >= 0 ? 'var(--secondary)' : 'var(--accent)'};">${remaining.toLocaleString('vi-VN', {maximumFractionDigits: 1})} fi</span>
                            </div>
                            <div class="kpi-icon-wrapper"><i class="fa-solid fa-boxes-stacked"></i></div>
                        </div>
                    </div>

                    <div class="grid-2">
                        <!-- Left Column: LO Oil Rate Configuration -->
                        <div class="glass-card">
                            <h3 style="color:var(--primary-light); margin-bottom:1.25rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">
                                <i class="fa-solid fa-sliders"></i> Định mức Dầu LO
                            </h3>
                            <form onsubmit="event.preventDefault(); app.saveLOConfig('${selectedVesselId}');">
                                <div class="form-group">
                                    <label class="form-label">Chu kỳ thay dầu hoàn toàn (Số giờ chạy)</label>
                                    <input type="number" class="form-control" id="lo-hours" value="${loHours}" required placeholder="Ví dụ: 800">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Số lượng fi thay thế hoàn toàn (drum)</label>
                                    <input type="number" step="any" class="form-control" id="lo-repl-qty" value="${loRepl}" required placeholder="Ví dụ: 8">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Số lượng fi thay thế/bù trong quá trình (drum)</label>
                                    <input type="number" step="any" class="form-control" id="lo-topup-qty" value="${loTopup}" required placeholder="Ví dụ: 3">
                                </div>
                                
                                <div style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:var(--radius-sm); margin-bottom:1.5rem; font-size:0.9rem; line-height:1.6;">
                                    <div>• Tổng dầu LO tiêu hao chu kỳ: <strong>${totalLO} fi</strong> (${loRepl}fi thay hoàn toàn + ${loTopup}fi bù quá trình)</div>
                                    <div>• Định mức tiêu hao mỗi giờ chạy: <strong>${hourlyRate.toFixed(5)} fi / giờ chạy</strong></div>
                                    <div style="margin-top:0.25rem; color:var(--info);">• Chi phí dầu LO mỗi chuyến = Số giờ chạy × ${hourlyRate.toFixed(5)} × Đơn giá dầu LO tại thời điểm cấp.</div>
                                </div>
                                
                                <button type="submit" class="btn btn-primary" style="width:100%;">
                                    <i class="fa-solid fa-floppy-disk"></i> Lưu định mức dầu LO
                                </button>
                            </form>
                        </div>

                        <!-- Right Column: Supplies Registry & History -->
                        <div class="glass-card">
                            <h3 style="color:var(--secondary); margin-bottom:1.25rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">
                                <i class="fa-solid fa-cart-plus"></i> Nhập/Cấp Dầu LO mới
                            </h3>
                            <form onsubmit="event.preventDefault(); app.saveLOSupply('${selectedVesselId}');" style="margin-bottom:2rem;">
                                <div class="grid-2">
                                    <div class="form-group">
                                        <label class="form-label">Thời gian cấp</label>
                                        <input type="date" class="form-control" id="lo-supply-date" value="${new Date().toISOString().substring(0, 10)}" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Nhà cung cấp (NCC)</label>
                                        <input type="text" class="form-control" id="lo-supply-vendor" placeholder="Nhập tên nhà cung cấp..." required>
                                    </div>
                                </div>
                                <div class="grid-2">
                                    <div class="form-group">
                                        <label class="form-label">Số lượng cấp (fi)</label>
                                        <input type="number" step="any" class="form-control" id="lo-supply-qty" placeholder="Ví dụ: 8" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Đơn giá nhập (VNĐ/fi)</label>
                                        <input type="number" step="any" class="form-control" id="lo-supply-price" placeholder="Nhập đơn giá..." required>
                                    </div>
                                </div>
                                <button type="submit" class="btn btn-success" style="width:100%;">
                                    <i class="fa-solid fa-plus"></i> Thêm phiếu cấp Dầu LO
                                </button>
                            </form>

                            <h3 style="color:var(--text-main); font-size:1rem; margin-bottom:0.75rem; text-transform:uppercase; letter-spacing:1px; opacity:0.8;">
                                Lịch sử cấp Dầu LO
                            </h3>
                            <div class="table-container" style="max-height: 250px;">
                                <table class="table" style="font-size:0.85rem;">
                                    <thead>
                                        <tr>
                                            <th>Ngày cấp</th>
                                            <th>Nhà cung cấp</th>
                                            <th style="text-align:right;">Số lượng</th>
                                            <th style="text-align:right;">Đơn giá/fi</th>
                                            <th style="text-align:center;">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${loSupplies.length === 0 ? `
                                            <tr>
                                                <td colspan="5" style="text-align:center; font-style:italic; padding:2rem; color:var(--text-muted);">
                                                    Chưa ghi nhận đợt cấp dầu LO nào cho tàu này.
                                                </td>
                                            </tr>
                                        ` : loSupplies.map(s => `
                                            <tr>
                                                <td>${s.date.split('-').reverse().join('/')}</td>
                                                <td><strong>${s.vendor}</strong></td>
                                                <td style="text-align:right;">${s.qty || 0} fi</td>
                                                <td style="text-align:right; font-weight:700; color:var(--secondary);">${AppData.formatCurrency(s.price)}</td>
                                                <td style="text-align:center;">
                                                    <button class="btn btn-outline" style="padding:0.1rem 0.3rem; border-color:var(--rose-light);" onclick="app.deleteLOSupply('${s.id}', '${selectedVesselId}')">
                                                        <i class="fa-solid fa-trash" style="color:var(--rose-light);"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Default to Dầu DO view
        const voyages = AppData.getFuelVoyages(selectedVesselId);
        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Quản lý Nhiên liệu (Dầu DO)</h1>
                        <p class="page-subtitle">Theo dõi theo từng Chuyến hàng (C1, C2...) cho tàu ${selectedVessel.name}</p>
                    </div>
                    
                    ${(() => {
                        const sortedVoyages = AppData.sortVoyages(voyages, 'asc');
                        const firstVoy = sortedVoyages[0];
                        const currentBalance = AppData.getVesselFuelBalance(selectedVesselId);
                        
                        return `
                            <div style="display:flex; gap:1.5rem; align-items:center;">
                                <div class="glass-card" style="padding:0.5rem 1rem; border-color:var(--primary-light); min-width:180px;">
                                    <small style="display:block; font-size:0.7rem; opacity:0.7; margin-bottom:0.2rem; text-transform:uppercase;">Tồn đầu tàu</small>
                                    <input type="text" class="form-control" style="background:transparent; border:none; padding:0; height:auto; font-weight:700; font-size:1.1rem; color:white; width:100%;" 
                                        value="${firstVoy ? (firstVoy.initialFuel || 0) : 0}" 
                                        onchange="app.updateInitialFuel('${firstVoy ? firstVoy.id : ''}', this.value)"
                                        placeholder="Nhập tồn đầu...">
                                </div>
                                <div class="glass-card" style="padding:0.5rem 1rem; border-color:var(--secondary); min-width:180px;">
                                    <small style="display:block; font-size:0.7rem; opacity:0.7; margin-bottom:0.2rem; text-transform:uppercase;">Tồn hiện tại</small>
                                    <div style="font-weight:700; font-size:1.1rem; color:var(--secondary);">${Math.round(currentBalance).toLocaleString()} L</div>
                                </div>
                            </div>
                        `;
                    })()}

                    <div style="display:flex; gap:1rem;">
                        <select class="form-control" onchange="app.navigate('fuel', this.value, 'DO')" style="width:auto;">
                            ${vessels.map(v => `<option value="${v.id}" ${v.id === selectedVesselId ? 'selected' : ''}>${v.id}</option>`).join('')}
                        </select>
                        <button class="btn btn-primary" onclick="app.openFuelVoyageModal('${selectedVesselId}')">
                            <i class="fa-solid fa-plus"></i> Tạo Chuyến Mới
                        </button>
                        <button class="btn btn-outline" onclick="app.exportFuelReport()">
                            <i class="fa-solid fa-file-excel"></i> Xuất Báo Cáo
                        </button>
                    </div>
                </div>

                <div class="tabs" style="display:flex; gap:10px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">
                    <button class="btn btn-primary" onclick="app.navigate('fuel', '${selectedVesselId}', 'DO')">
                        <i class="fa-solid fa-gas-pump"></i> Dầu DO
                    </button>
                    <button class="btn btn-outline" onclick="app.navigate('fuel', '${selectedVesselId}', 'LO')">
                        <i class="fa-solid fa-oil-can"></i> Dầu LO (Lube Oil)
                    </button>
                </div>

                <div class="grid-1">
                    ${voyages.length === 0 ? '<div class="glass-card" style="text-align:center; padding:3rem;"><p>Chưa có chuyến hàng nào được ghi nhận cho tàu này.</p></div>' : ''}
                    ${(() => {
                        const sorted = AppData.sortVoyages(voyages, 'asc');
                        let runningBalance = Number(sorted[0]?.initialFuel || 0);
                        
                        return sorted.map(voy => {
                            const stats = AppData.getFuelVoyageStats(voy.id);
                            const logs = AppData.getFuelLogs(voy.id);
                            const prevBalance = runningBalance;
                            runningBalance += Number(voy.addedFuel || 0) - stats.totalFuel;
                            
                            return `
                                <div class="glass-card" style="margin-bottom:2rem;">
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-color); padding-bottom:1rem; margin-bottom:1rem;">
                                        <div>
                                            <h3 style="color:var(--primary-light);">Chuyến: ${voy.voyageNo}</h3>
                                            <p style="font-size:0.9rem; opacity:0.8;">Loại hàng: ${voy.cargoType || '---'}</p>
                                        </div>
                                        <div style="text-align:right;">
                                            <div style="font-size:0.8rem; margin-bottom:0.5rem;">
                                                Tiếp dầu: <strong>${Math.round(voy.addedFuel || 0).toLocaleString()} L</strong> 
                                                ${voy.fuelDate ? ` | Ngày: <strong>${voy.fuelDate}</strong>` : ''}
                                                ${voy.fuelVendor ? ` | NCC: <strong>${voy.fuelVendor}</strong>` : ''}
                                                ${voy.fuelLocation ? ` | Tại: <strong>${voy.fuelLocation}</strong>` : ''}
                                            </div>
                                            <div style="margin-bottom:0.5rem;"><small>Đơn giá: <strong>${AppData.formatCurrency(voy.fuelUnitPrice)}</strong></small></div>
                                            <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="app.openFuelVoyageModal('${selectedVesselId}', '${voy.id}')">
                                                <i class="fa-solid fa-pen"></i> Sửa Chuyến
                                            </button>
                                            <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem; border-color:var(--rose-light);" onclick="app.deleteFuelVoyage('${voy.id}')">
                                                <i class="fa-solid fa-trash" style="color:var(--rose-light);"></i>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="grid-3" style="margin-bottom:1.5rem; background:rgba(255,255,255,0.03); padding:1rem; border-radius:var(--radius-sm);">
                                        <div><small class="stat-label">Tổng giờ hành trình</small><div style="font-size:1.1rem; font-weight:700;">${stats.totalHours.toFixed(1)} h</div></div>
                                        <div><small class="stat-label">Tiêu thụ toàn chuyến</small><div style="font-size:1.1rem; font-weight:700; color:var(--rose-light);">${Math.round(stats.totalFuel).toLocaleString()} L</div></div>
                                        <div><small class="stat-label">Tồn cuối chuyến</small><div style="font-size:1.1rem; font-weight:700; color:var(--secondary);">${Math.round(runningBalance).toLocaleString()} L</div></div>
                                    </div>

                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                                    <h4 style="font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; opacity:0.7;">Chi tiết các chặng</h4>
                                    <button class="btn btn-primary" style="padding:0.2rem 0.6rem; font-size:0.8rem;" onclick="app.openFuelLogModal('${voy.id}')">
                                        <i class="fa-solid fa-plus"></i> Thêm Chặng
                                    </button>
                                </div>

                                <div class="table-container">
                                    <table class="table" style="font-size:0.85rem;">
                                        <thead>
                                            <tr><th>Nơi đi</th><th>Thời gian đi</th><th>Nơi đến</th><th>Thời gian đến</th><th>Định mức</th><th>Số giờ</th><th>Thao tác</th></tr>
                                        </thead>
                                        <tbody>
                                            ${logs.map(l => `
                                                <tr>
                                                    <td>${l.startPos}</td>
                                                    <td><small>${(l.startTime || '').replace('T', ' ')}</small></td>
                                                    <td>${l.endPos}</td>
                                                    <td><small>${(l.endTime || '').replace('T', ' ')}</small></td>
                                                    <td>${Math.round(l.fuelRate)} L/h</td>
                                                    <td><strong>${l.hours}h</strong></td>
                                                    <td>
                                                        <button class="btn btn-outline" style="padding:0.1rem 0.3rem;" onclick="app.editFuelLog('${voy.id}', '${l.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                                        <button class="btn btn-outline" style="padding:0.1rem 0.3rem;" onclick="app.deleteFuelLog('${l.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `;
                        }).reverse().join('')
                    })()}
                </div>
            </div>
        `;
    },

    fuelVoyageModal: (vesselId, voyageId) => {
        const voyage = voyageId ? AppData.getFuelVoyage(voyageId) : null;
        return `
            <div class="modal-header">
                <h3>${voyage ? 'Sửa Chuyến Hàng' : 'Tạo Chuyến Hàng Mới'}</h3>
                <button class="modal-close" onclick="app.closeModal('fuel-voyage-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveFuelVoyage();">
                    <input type="hidden" id="fv-id" value="${voyageId || ''}">
                    <input type="hidden" id="fv-vessel-id" value="${vesselId}">
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Tên chuyến (Ví dụ: C1, C2...)</label>
                            <input type="text" class="form-control" id="fv-no" value="${voyage ? voyage.voyageNo : ''}" required placeholder="Nhập mã chuyến">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Loại hàng vận chuyển</label>
                            <input type="text" class="form-control" id="fv-cargo" value="${voyage ? (voyage.cargoType || '') : ''}" required placeholder="Ví dụ: Clinker, Than...">
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Nhiên liệu tiếp thêm (Lít)</label>
                            <input type="number" step="any" class="form-control" id="fv-added" value="${voyage ? voyage.addedFuel : 0}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Đơn giá nhiên liệu tiếp thêm</label>
                            <input type="number" step="any" class="form-control" id="fv-price" value="${voyage ? voyage.fuelUnitPrice : 20000}" required>
                        </div>
                    <div class="grid-3">
                        <div class="form-group">
                            <label class="form-label">Ngày cấp</label>
                            <input type="date" class="form-control" id="fv-date" value="${voyage ? (voyage.fuelDate || '') : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Nhà cung cấp</label>
                            <input type="text" class="form-control" id="fv-vendor" value="${voyage ? (voyage.fuelVendor || '') : ''}" list="fuel-vendor-list" placeholder="Chọn hoặc nhập...">
                            <datalist id="fuel-vendor-list">
                                ${AppData.getVendors().map(v => `<option value="${v.name}"></option>`).join('')}
                            </datalist>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Địa điểm cấp</label>
                            <input type="text" class="form-control" id="fv-location" value="${voyage ? (voyage.fuelLocation || '') : ''}" placeholder="Cảng/Vị trí...">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary">${voyage ? 'Cập nhật Chuyến' : 'Lưu Chuyến Mới'}</button>
                    </div>
                </form>
            </div>
        `;
    },

    fuelModal: (voyageId) => {
        return `
            <div class="modal-header"><h3>Nhập Lộ Trình Chặng</h3><button class="modal-close" onclick="app.closeModal('fuel-modal')">&times;</button></div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveFuelLog();">
                    <input type="hidden" id="f-id">
                    <input type="hidden" id="f-voyage-id" value="${voyageId}">
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Thời gian đi</label><input type="datetime-local" class="form-control" id="f-start-time" onchange="app.calcFuelLogHours()"></div>
                        <div class="form-group"><label class="form-label">Nơi đi</label><input type="text" class="form-control" id="f-start-pos"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Thời gian đến</label><input type="datetime-local" class="form-control" id="f-end-time" onchange="app.calcFuelLogHours()"></div>
                        <div class="form-group"><label class="form-label">Nơi đến</label><input type="text" class="form-control" id="f-end-pos"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Định mức (Lít/giờ)</label><input type="number" step="any" class="form-control" id="f-fuel-rate" required placeholder="Ví dụ: 150"></div>
                        <div class="form-group"><label class="form-label">Số giờ nổ máy</label><input type="number" step="any" class="form-control" id="f-hours" readonly style="background:rgba(0,0,0,0.2);"></div>
                    </div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary">Lưu Chặng</button></div>
                </form>
            </div>
        `;
    },

    partners: (activeTab = 'vendor') => {
        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Nha cung cap - Khach hang</h1>
                        <p class="page-subtitle">Quan ly mang luoi doi tac kinh doanh</p>
                    </div>
                    <button class="btn btn-primary" onclick="app.openPartnerModal('${activeTab}')">
                        <i class="fa-solid fa-plus"></i>
                        ${activeTab === 'vendor' ? 'Them NCC' : 'Them Khach hang'}
                    </button>
                </div>
                <div class="glass-card">
                    <div style="display:flex; gap:1rem; border-bottom:1px solid var(--border-color); margin-bottom:1.5rem;">
                        <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${activeTab === 'vendor' ? 'var(--primary-light)' : 'transparent'}; border-radius:0;" onclick="app.navigate('partners', 'vendor')">Nha cung cap</button>
                        <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${activeTab === 'customer' ? 'var(--primary-light)' : 'transparent'}; border-radius:0;" onclick="app.navigate('partners', 'customer')">Khach hang</button>
                    </div>
                    <div class="table-container">
                        <table class="table">
                            <thead><tr><th>Ten doi tac</th><th>Dia chi</th><th>So dien thoai</th><th>Thao tac</th></tr></thead>
                            <tbody>
                                ${activeTab === 'vendor' ? 
                                    (AppData.getVendors().length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">Chua co nha cung cap nao. Nhan "Them NCC" de bat dau.</td></tr>' :
                                    AppData.getVendors().map(v => `<tr><td><strong>${v.name}</strong> <span class="badge badge-outline">NCC</span></td><td>${v.address || '---'}</td><td>${v.contact || '---'}</td><td>
                                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem;" onclick="app.editVendor('${v.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem;" onclick="app.deleteVendor('${v.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                    </td></tr>`).join('')) :
                                    (AppData.getCustomers().length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">Chua co khach hang nao. Nhan "Them Khach hang" de bat dau.</td></tr>' :
                                    AppData.getCustomers().map(c => `<tr><td><strong>${c.name}</strong> <span class="badge badge-outline">KH</span></td><td>${c.address || '---'}</td><td>${c.contact || '---'}</td><td>
                                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem;" onclick="app.editCustomer('${c.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem;" onclick="app.deleteCustomer('${c.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                    </td></tr>`).join(''))
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    partnerModal: (type, partner = null) => {
        const isVendor = type === 'vendor';
        const title = partner ? (isVendor ? 'Sua Nha Cung Cap' : 'Sua Khach Hang') : (isVendor ? 'Them Nha Cung Cap Moi' : 'Them Khach Hang Moi');
        return `
            <div class="modal-header">
                <h3><i class="fa-solid fa-${isVendor ? 'truck' : 'user-tie'}"></i> ${title}</h3>
                <button class="modal-close" onclick="app.closeModal('partner-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.savePartner('${type}');">
                    <input type="hidden" id="p-id" value="${partner ? partner.id : ''}">
                    <input type="hidden" id="p-type" value="${type}">
                    <div class="form-group">
                        <label class="form-label">Ten ${isVendor ? 'Nha cung cap' : 'Khach hang'} <span style="color:var(--accent)">*</span></label>
                        <input type="text" class="form-control" id="p-name" value="${partner ? partner.name : ''}" required placeholder="Nhap ten doi tac..." autofocus>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">So dien thoai</label>
                            <input type="text" class="form-control" id="p-contact" value="${partner ? (partner.contact || '') : ''}" placeholder="VD: 0987654321">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Dia chi</label>
                            <input type="text" class="form-control" id="p-address" value="${partner ? (partner.address || '') : ''}" placeholder="Tinh/Thanh pho...">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="app.closeModal('partner-modal')">Huy</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Luu</button>
                    </div>
                </form>
            </div>
        `;
    },

    'monthly-costs': () => {
        const vessels = AppData.getVessels();
        const month = app.lastMonthlyCostsMonth || new Date().toISOString().substring(0, 7);
        const firstVesselId = app.lastMonthlyCostsVesselId || (vessels[0] ? vessels[0].id : '');
        const costs = AppData.getMonthlyCosts(month, firstVesselId);
        return `
            <div class="view-section">
                <div class="page-header"><div><h1 class="page-title">Chi phí theo Tháng</h1><p class="page-subtitle">Nhập liệu chi phí để phân bổ vào chuyến hàng</p></div></div>
                <div class="glass-card" style="max-width:600px;">
                    <form onsubmit="event.preventDefault(); app.saveMonthlyCosts();">
                        <div class="grid-2">
                            <div class="form-group"><label class="form-label">Chọn tháng</label><input type="month" class="form-control" id="m-month" value="${month}" onchange="app.loadMonthlyCosts()"></div>
                            <div class="form-group">
                                <label class="form-label">Chọn tàu</label>
                                <select class="form-control" id="m-vessel" onchange="app.loadMonthlyCosts()">
                                    ${vessels.map(v => `<option value="${v.id}" ${v.id === firstVesselId ? 'selected' : ''}>${v.id}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group"><label class="form-label">Lương tổng (VND)</label><input type="number" step="any" class="form-control" id="m-salary" value="${costs.salary || 0}"></div>
                        <div class="form-group"><label class="form-label">Bảo hiểm (VND)</label><input type="number" step="any" class="form-control" id="m-ins" value="${costs.insurance || 0}"></div>
                        
                        <div class="form-group">
                            <label class="form-label">Tiền ăn uống (VND) <span style="font-size:0.75rem; color:var(--secondary); font-weight:normal;">(Tự động từ Báo cáo Tàu hoặc tự nhập)</span></label>
                            <input type="number" step="any" class="form-control" id="m-food" value="${costs.food || 0}">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Vật tư, sửa chữa Công ty cấp (VND) <span style="font-size:0.75rem; color:var(--info); font-weight:normal;">(Tự nhập tại đây)</span></label>
                            <input type="number" step="any" class="form-control" id="m-material-company" value="${costs.materialCompany || 0}">
                        </div>

                        <div class="grid-2" style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 1rem;">
                            <div class="form-group" style="margin:0;">
                                <label class="form-label">1. Lãi vay ngân hàng (VND) <span style="font-size:0.75rem; color:var(--info); font-weight:normal;">(Tự động / Tự nhập)</span></label>
                                <input type="number" step="any" class="form-control" id="m-loan-interest" value="${costs.loanInterest || 0}">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label class="form-label">2. Lãi vay ngoài (VND) <span style="font-size:0.75rem; color:var(--warning); font-weight:normal;">(Tự nhập)</span></label>
                                <input type="number" step="any" class="form-control" id="m-loan-interest-external" value="${costs.loanInterestExternal || 0}">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Vật tư, sửa chữa Tàu chi (VND) <span style="font-size:0.75rem; color:var(--warning); font-weight:normal;">(Tự động lấy từ Báo cáo Tàu)</span></label>
                            <input type="number" step="any" class="form-control" id="m-material-vessel" value="${costs.materialVessel || 0}" readonly style="background:rgba(0,0,0,0.3); color:var(--text-muted);">
                        </div>
                        
                        <div class="form-group"><label class="form-label">Chi phí khác (VND)</label><input type="number" step="any" class="form-control" id="m-other" value="${costs.other || 0}"></div>
                        <button type="submit" class="btn btn-primary" style="width:100%;">Lưu chi phí tháng</button>
                    </form>
                </div>
            </div>
        `;
    },

    'vessel-expenses': () => {
        const vessels = AppData.getVessels();
        const month = app.lastVesselExpensesMonth || new Date().toISOString().substring(0, 7);
        const firstVesselId = app.lastVesselExpensesVesselId || (vessels[0] ? vessels[0].id : '');
        const stats = AppData.getVesselFundStats(firstVesselId, month);

        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Quản lý Báo cáo Thuyền trưởng & Quỹ Tàu</h1>
                        <p class="page-subtitle">Quản lý các khoản chi tiêu thực tế của Thuyền trưởng và phân bổ trực tiếp/theo ngày vào các Chuyến đi</p>
                    </div>
                </div>

                <!-- Selector & Fund Stats Grid -->
                <div class="grid-3" style="grid-template-columns: 1fr 2fr; gap: 1.5rem; margin-bottom: 2rem;">
                    <!-- Select Month/Vessel Card -->
                    <div class="glass-card" style="padding: 1.5rem; display: flex; flex-direction: column; justify-content: center; gap: 1rem;">
                        <h3 style="color: var(--accent); margin: 0 0 0.5rem 0;"><i class="fa-solid fa-filter"></i> Lọc dữ liệu</h3>
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label">Chọn tháng</label>
                            <input type="month" class="form-control" id="ve-month" value="${month}" onchange="app.loadVesselExpenses()">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label">Chọn tàu</label>
                            <select class="form-control" id="ve-vessel" onchange="app.loadVesselExpenses()">
                                ${vessels.map(v => `<option value="${v.id}" ${v.id === firstVesselId ? 'selected' : ''}>${v.id}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- 4 Stats Cards Grid -->
                    <div class="grid-4" style="gap: 1rem; margin: 0;">
                        <!-- Opening Balance -->
                        <div class="stat-card glass-panel" style="border-left: 4px solid var(--info); background: linear-gradient(135deg, rgba(0, 180, 216, 0.05), rgba(0,0,0,0.2));">
                            <div class="stat-header">
                                <span class="stat-label">Tồn Quỹ Đầu Kỳ</span>
                                <i class="fa-solid fa-calculator" style="color: var(--info);"></i>
                            </div>
                            <div class="stat-value" id="ve-stat-opening" style="font-size: 1.3rem; color: var(--info); font-weight:600;">${AppData.formatCurrency(stats.opening)}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">Kết chuyển từ các tháng trước</div>
                        </div>

                        <!-- Income (Advances) -->
                        <div class="stat-card glass-panel" style="border-left: 4px solid var(--secondary); background: linear-gradient(135deg, rgba(0, 255, 100, 0.05), rgba(0,0,0,0.2));">
                            <div class="stat-header">
                                <span class="stat-label">Công Ty Tạm Ứng</span>
                                <i class="fa-solid fa-arrow-down-long" style="color: var(--secondary);"></i>
                            </div>
                            <div class="stat-value" id="ve-stat-income" style="font-size: 1.3rem; color: var(--secondary); font-weight:600;">${AppData.formatCurrency(stats.income)}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">Từ chi nhánh (1.Tàu Ứng)</div>
                        </div>

                        <!-- Expense -->
                        <div class="stat-card glass-panel" style="border-left: 4px solid var(--rose-light); background: linear-gradient(135deg, rgba(255, 0, 100, 0.05), rgba(0,0,0,0.2));">
                            <div class="stat-header">
                                <span class="stat-label">Tàu Đã Chi</span>
                                <i class="fa-solid fa-arrow-up-long" style="color: var(--rose-light);"></i>
                            </div>
                            <div class="stat-value" id="ve-stat-expense" style="font-size: 1.3rem; color: var(--rose-light); font-weight:600;">${AppData.formatCurrency(stats.expense)}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">Tổng cộng từ báo cáo tháng</div>
                        </div>

                        <!-- Current Balance -->
                        <div class="stat-card glass-panel" style="border-left: 4px solid var(--warning); background: linear-gradient(135deg, rgba(255, 160, 0, 0.05), rgba(0,0,0,0.2));">
                            <div class="stat-header">
                                <span class="stat-label">Tồn Quỹ Hiện Tại</span>
                                <i class="fa-solid fa-wallet" style="color: var(--warning);"></i>
                            </div>
                            <div class="stat-value" id="ve-stat-balance" style="font-size: 1.3rem; color: var(--warning); font-weight: 700;">${AppData.formatCurrency(stats.balance)}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">Số dư két tiền mặt tại tàu</div>
                        </div>
                    </div>
                </div>

                <!-- Structured Input Section Grid -->
                <div class="grid-2" style="grid-template-columns: 1.15fr 1.85fr; gap: 1.5rem; align-items: start;">
                    <!-- Left column: Captain's Monthly Form Summary -->
                    <div class="glass-card" style="padding: 1.5rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                            <h3 style="margin:0; color:var(--info); font-size:1.1rem;"><i class="fa-solid fa-file-invoice-dollar"></i> Nhập Báo cáo Thuyền trưởng</h3>
                            <span class="badge badge-info" style="font-size:0.75rem;">Nhập tay hàng tháng</span>
                        </div>
                        
                        <!-- 1. Tiền ăn uống -->
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label class="form-label" style="font-weight: 600; color: var(--text-main);"><i class="fa-solid fa-utensils"></i> 1. Tiền ăn & bồi dưỡng TV</label>
                            <input type="number" class="form-control" id="ve-food" placeholder="Tính từ chi tiết bên phải..." readonly style="background: rgba(255,255,255,0.05); font-weight:600; color: var(--secondary); cursor: not-allowed; pointer-events: none;">
                            <small class="form-text text-muted">Chi phí ăn uống tự động tính từ khung chi tiết ở bên phải.</small>
                        </div>

                        <!-- 4. Vật tư & CP khác -->
                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label class="form-label" style="font-weight: 600; color: var(--text-main);"><i class="fa-solid fa-wrench"></i> 4. Tiền Vật tư, sửa chữa (Tàu chi)</label>
                            <input type="number" class="form-control" id="ve-material" placeholder="Tính từ chi tiết bên phải..." readonly style="background: rgba(255,255,255,0.05); font-weight:600; color: var(--secondary); cursor: not-allowed; pointer-events: none;">
                            <small class="form-text text-muted">Chi phí vật tư tự động tính từ khung chi tiết ở bên phải.</small>
                        </div>

                        <!-- 2. Chi phí cảng -->
                        <div style="margin-bottom: 1.5rem;">
                            <label class="form-label" style="font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; display:block;"><i class="fa-solid fa-anchor"></i> 2. Chi phí tại các đầu cảng (Tổng hợp tự động)</label>
                            <div id="ve-ports-container" style="background: rgba(0,0,0,0.2); border: 1px dashed var(--border-color); border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; min-height: 50px;">
                                <!-- Port rows dynamically added -->
                            </div>
                            <small class="form-text text-muted" style="display:block; margin-top:-0.25rem; margin-bottom:0.5rem;">Danh sách cảng được tổng hợp tự động theo Cảng + Chuyến từ chi tiết bên phải.</small>
                        </div>

                        <!-- 3. Tiền Bông từng chuyến -->
                        <div style="margin-bottom: 1.5rem;">
                            <label class="form-label" style="font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; display:block;"><i class="fa-solid fa-handshake"></i> 3. Tiền Bông từng chuyến</label>
                            <div id="ve-brokerages-container" style="background: rgba(0,0,0,0.2); border: 1px dashed var(--border-color); border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; min-height: 50px;">
                                <!-- Brokerage rows dynamically added -->
                            </div>
                            <button type="button" class="btn btn-outline btn-xs" onclick="app.addBrokerageRow()" style="font-size:0.75rem; padding: 4px 8px; border-color: rgba(255,255,255,0.15);"><i class="fa-solid fa-plus"></i> Thêm Tiền Bông</button>
                        </div>

                        <!-- Save/Reset action buttons -->
                        <div style="display:flex; gap:1rem; margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                            <button type="button" class="btn btn-outline" onclick="app.resetCaptainReportForm()" style="flex:1;"><i class="fa-solid fa-arrow-rotate-left"></i> Xóa Trống</button>
                            <button type="button" class="btn btn-primary" onclick="app.saveMonthlyCaptainReport()" style="flex:2; font-weight:700;"><i class="fa-solid fa-cloud-arrow-up"></i> CẬP NHẬT CHI PHÍ</button>
                        </div>
                    </div>

                    <!-- Right column: Detailed Inputs for Food, Material and Ports -->
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <!-- Panel 1: Chi tiết Tiền ăn & Bồi dưỡng TV -->
                        <div class="glass-card" style="padding: 1.5rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                <h3 style="margin:0; color:var(--info); font-size:1.1rem;"><i class="fa-solid fa-utensils"></i> Chi tiết Tiền ăn & Bồi dưỡng TV</h3>
                                <span style="font-weight:600; color:var(--secondary); font-size:0.9rem;" id="ve-food-detail-total">0đ</span>
                            </div>
                            <div class="table-responsive" style="margin-bottom: 0.5rem; max-height: 200px; overflow-y: auto;">
                                <table class="table" style="background: rgba(0,0,0,0.1); font-size: 0.8rem; margin: 0;">
                                    <thead>
                                        <tr>
                                            <th style="padding: 4px 6px !important;">Nội dung chi tiết</th>
                                            <th style="width: 160px; text-align: right; padding: 4px 6px !important;">Số tiền (VND)</th>
                                            <th style="width: 45px; text-align: center; padding: 4px 6px !important;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="ve-food-details-body">
                                        <!-- Dynamic rows -->
                                    </tbody>
                                </table>
                            </div>
                            <button type="button" class="btn btn-outline btn-xs" onclick="app.addFoodDetailRow()" style="font-size:0.75rem; padding: 4px 8px; border-color: rgba(255,255,255,0.15);"><i class="fa-solid fa-plus"></i> Thêm chi tiết tiền ăn</button>
                        </div>

                        <!-- Panel 2: Chi tiết Chi phí tại các đầu cảng (Grouped version) -->
                        <div class="glass-card" style="padding: 1.5rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                <h3 style="margin:0; color:var(--info); font-size:1.1rem;"><i class="fa-solid fa-anchor"></i> Chi tiết Chi phí tại các đầu cảng</h3>
                                <span style="font-weight:600; color:var(--secondary); font-size:0.9rem;" id="ve-port-detail-total">0đ</span>
                            </div>
                            <div id="ve-port-groups-container" style="max-height: 380px; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 0.75rem;">
                                <!-- Port-Voyage groups will be generated here -->
                            </div>
                            <button type="button" class="btn btn-outline btn-xs" onclick="app.addPortDetailGroup('', '', true)" style="font-size:0.75rem; padding: 4px 8px; border-color: rgba(255,255,255,0.15); margin-top: 0.5rem;"><i class="fa-solid fa-plus"></i> Thêm Cảng & Chuyến mới</button>
                        </div>

                        <!-- Panel 3: Chi tiết Chi phí Vật tư -->
                        <div class="glass-card" style="padding: 1.5rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                <h3 style="margin:0; color:var(--info); font-size:1.1rem;"><i class="fa-solid fa-wrench"></i> Chi tiết Vật tư, sửa chữa (Tàu chi)</h3>
                                <span style="font-weight:600; color:var(--secondary); font-size:0.9rem;" id="ve-material-detail-total">0đ</span>
                            </div>
                            <div class="table-responsive" style="margin-bottom: 0.5rem; max-height: 200px; overflow-y: auto;">
                                <table class="table" style="background: rgba(0,0,0,0.1); font-size: 0.8rem; margin: 0;">
                                    <thead>
                                        <tr>
                                            <th style="padding: 4px 6px !important;">Nội dung chi tiết</th>
                                            <th style="width: 160px; text-align: right; padding: 4px 6px !important;">Số tiền (VND)</th>
                                            <th style="width: 45px; text-align: center; padding: 4px 6px !important;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="ve-material-details-body">
                                        <!-- Dynamic rows -->
                                    </tbody>
                                </table>
                            </div>
                            <button type="button" class="btn btn-outline btn-xs" onclick="app.addMaterialDetailRow()" style="font-size:0.75rem; padding: 4px 8px; border-color: rgba(255,255,255,0.15);"><i class="fa-solid fa-plus"></i> Thêm chi tiết vật tư</button>
                        </div>
                    </div>
                </div>

                <!-- Voyage Allocation Table at the very bottom, full width -->
                <div class="glass-card" style="padding: 1.5rem; margin-top: 1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                        <h3 style="margin:0; color:var(--accent); font-size:1.1rem;"><i class="fa-solid fa-ship"></i> Phân bổ Chi phí vào các Chuyến trong tháng</h3>
                        <span class="badge badge-success" style="font-size:0.75rem;">Đồng bộ Tức thì</span>
                    </div>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.25rem; line-height: 1.45;">
                        Các chuyến hàng chạy trong tháng của tàu được lọc dưới đây sẽ tự động nhận phân bổ từ Báo cáo Thuyền trưởng (theo số ngày chạy chuyến hoặc gán trực tiếp).
                    </p>
                    <div class="table-responsive">
                        <table class="table" style="background: rgba(0,0,0,0.15);">
                            <thead>
                                <tr>
                                    <th>Mã chuyến</th>
                                    <th>Thời gian chạy</th>
                                    <th style="text-align: right;">Tiền ăn</th>
                                    <th style="text-align: right;">Vật tư tàu chi</th>
                                    <th style="text-align: right;">Cảng tàu chi</th>
                                    <th style="text-align: right;">Tiền bông</th>
                                    <th style="text-align: right; color:var(--rose-light);">Tổng chi két tàu</th>
                                </tr>
                            </thead>
                            <tbody id="ve-allocated-voyages">
                                <!-- Populated dynamically via JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    shipments: (filterMonth = '', filterYear = '', filterVessel = '', filterCustomer = '') => {
        const allShips = AppData.getShipments()
            .slice()
            .sort((a, b) => {
                const hasA = a.contractNo && a.contractNo.trim() !== '';
                const hasB = b.contractNo && b.contractNo.trim() !== '';
                
                if (!hasA && hasB) return -1;
                if (hasA && !hasB) return 1;
                if (!hasA && !hasB) {
                    const dateA = a.dateStart || '';
                    const dateB = b.dateStart || '';
                    return dateB.localeCompare(dateA); // Mới nhất lên đầu
                }
                
                const numA = parseInt((a.contractNo || '').replace(/\D/g, '')) || 0;
                const numB = parseInt((b.contractNo || '').replace(/\D/g, '')) || 0;
                return numB - numA; // Giảm dần
            });

        // 1. Extract years dynamically
        const uniqueYears = Array.from(new Set(allShips.map(s => {
            if (s.reportMonth && s.reportMonth.length >= 4) return parseInt(s.reportMonth.substring(0, 4));
            const date = s.dateStart || s.dateEnd;
            return date ? new Date(date).getFullYear() : null;
        }).filter(Boolean))).sort((a, b) => b - a);

        // 2. Extract vessels
        const vessels = AppData.getVessels();

        // 3. Extract customers/partners
        const uniqueCustomers = Array.from(new Set(allShips.map(s => s.customer).filter(Boolean))).sort();

        // Apply filters
        let ships = allShips;

        if (filterMonth) {
            ships = ships.filter(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (m && m.includes('-')) {
                    const monthPart = m.split('-')[1];
                    return monthPart === filterMonth;
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

        return `
            <div class="view-section">
                <div class="page-header">
                    <div><h1 class="page-title">Quản lý Chuyến hàng</h1><p class="page-subtitle">Theo dõi doanh thu, chi phí và hiệu quả từng mã chuyến</p></div>
                    <div>
                        <button class="btn btn-outline" onclick="app.exportShipmentReport()" style="margin-right: 8px;">
                            <i class="fa-solid fa-file-excel"></i> Xuất Báo Cáo
                        </button>
                        <button class="btn btn-primary" onclick="app.openShipmentModal()"><i class="fa-solid fa-plus"></i> Thêm Chuyến Mới</button>
                    </div>
                </div>

                <!-- Filter Bar -->
                <div class="glass-card" style="margin-bottom: 1.5rem; padding: 1rem 1.5rem;">
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 1rem;">
                        <!-- Filter Year -->
                        <div class="form-group" style="margin: 0; width: 140px;">
                            <label class="form-label" style="margin-bottom: 0.25rem; font-size: 0.75rem;">Chọn Năm</label>
                            <select class="form-control" style="width: 100%;" onchange="app.navigate('shipments', '${filterMonth}', this.value, '${filterVessel}', '${filterCustomer}')">
                                <option value="">-- Tất cả năm --</option>
                                ${uniqueYears.map(y => `<option value="${y}" ${String(y) === String(filterYear) ? 'selected' : ''}>Năm ${y}</option>`).join('')}
                            </select>
                        </div>
                        <!-- Filter Month -->
                        <div class="form-group" style="margin: 0; width: 140px;">
                            <label class="form-label" style="margin-bottom: 0.25rem; font-size: 0.75rem;">Chọn Tháng</label>
                            <select class="form-control" style="width: 100%;" onchange="app.navigate('shipments', this.value, '${filterYear}', '${filterVessel}', '${filterCustomer}')">
                                <option value="">-- Tất cả tháng --</option>
                                ${Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0')).map(m => `
                                    <option value="${m}" ${m === filterMonth ? 'selected' : ''}>Tháng ${m}</option>
                                `).join('')}
                            </select>
                        </div>
                        <!-- Filter Vessel -->
                        <div class="form-group" style="margin: 0; width: 160px;">
                            <label class="form-label" style="margin-bottom: 0.25rem; font-size: 0.75rem;">Chọn Tàu</label>
                            <select class="form-control" style="width: 100%;" onchange="app.navigate('shipments', '${filterMonth}', '${filterYear}', this.value, '${filterCustomer}')">
                                <option value="">-- Tất cả tàu --</option>
                                ${vessels.map(v => `<option value="${v.id}" ${v.id === filterVessel ? 'selected' : ''}>Tàu ${v.name}</option>`).join('')}
                            </select>
                        </div>
                        <!-- Filter Customer -->
                        <div class="form-group" style="margin: 0; width: 220px;">
                            <label class="form-label" style="margin-bottom: 0.25rem; font-size: 0.75rem;">Chọn Đối Tác</label>
                            <select class="form-control" style="width: 100%;" onchange="app.navigate('shipments', '${filterMonth}', '${filterYear}', '${filterVessel}', this.value)">
                                <option value="">-- Tất cả đối tác --</option>
                                ${uniqueCustomers.map(c => `<option value="${c}" ${c === filterCustomer ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                        <!-- Reset Button -->
                        ${(filterMonth || filterYear || filterVessel || filterCustomer) ? `
                            <button class="btn btn-outline" style="margin-top: 1.2rem; padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="app.navigate('shipments', '', '', '', '')">
                                <i class="fa-solid fa-rotate-left"></i> Xóa bộ lọc
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="glass-card">
                    <div class="double-scroll-wrapper" id="shipments-scroll-wrapper">
                        <div class="top-scrollbar" style="overflow-x: auto; overflow-y: hidden; height: 8px; margin-bottom: 6px; border-radius: 4px; display: none;">
                            <div class="top-scrollbar-dummy" style="height: 1px;"></div>
                        </div>
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr><th>Mã HĐ</th><th>Chuyến số</th><th>Khách hàng</th><th>Tàu</th><th>Số ngày</th><th>Doanh thu thực</th><th>Doanh thu HĐ</th><th>Tiền gửi lại</th><th>Hiệu quả</th><th>Thao tác</th></tr>
                                </thead>
                                <tbody>
                                    ${ships.map(s => {
                                        const costSum = Object.values(s.costs || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
                                        const profit = s.revenueReal - costSum;
                                        return `
                                            <tr>
                                                <td><strong>${s.contractNo || '---'}</strong></td>
                                                <td><span class="badge badge-outline">${s.voyageNo || '---'}</span></td>
                                                <td><span class="text-info">${s.customer || '---'}</span></td>
                                                <td><span class="badge badge-success">${s.vesselId}</span></td>
                                                <td><strong>${AppData.calcDays(s.dateStart, s.dateEnd)}</strong> ngày</td>
                                                <td>${AppData.formatCurrency(s.revenueReal)}</td>
                                                <td>${AppData.formatCurrency(s.revenueInvoice)}</td>
                                                <td style="color:var(--warning)">${AppData.formatCurrency(s.refundAmount)}</td>
                                                <td class="${profit >= 0 ? 'value-positive' : 'value-negative'}"><strong>${AppData.formatCurrency(profit)}</strong></td>
                                                <td>
                                                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" title="Xem Báo Cáo" onclick="app.openShipmentReport('${s.id}')"><i class="fa-solid fa-file-invoice-dollar" style="color:var(--success)"></i></button>
                                                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" title="Sửa" onclick="app.editShipment('${s.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" title="Xóa" onclick="app.deleteShipment('${s.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    shipModal: () => {
        return `
            <div class="modal-header"><h3>Nhập Liệu Chuyến Hàng</h3><button class="modal-close" onclick="app.closeModal('ship-modal')">&times;</button></div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveShipment();">
                    <input type="hidden" id="s-id">
                    <div class="grid-3">
                        <div class="form-group"><label class="form-label">Mã Hợp đồng</label><input type="text" class="form-control" id="s-contract-no"></div>
                        <div class="form-group"><label class="form-label">Chuyến số (Ví dụ: C1)</label><input type="text" class="form-control" id="s-voy-no" required oninput="app.syncShipmentFuel()"></div>
                        <div class="form-group"><label class="form-label">Tàu</label><select class="form-control" id="s-vessel-id" onchange="app.handleShipmentVesselChange()">${AppData.getVessels().map(v => `<option value="${v.id}">${v.name}</option>`).join('')}</select></div>
                    </div>
                    <div class="grid-3">
                        <div class="form-group"><label class="form-label">Tên khách hàng</label>
                            <input type="text" class="form-control" id="s-customer" list="customer-list" placeholder="Chọn hoặc nhập..." required>
                            <datalist id="customer-list">
                                ${AppData.getCustomers().map(c => `<option value="${c.name}"></option>`).join('')}
                            </datalist>
                        </div>
                        <div class="form-group"><label class="form-label">Tên hàng</label>
                            <input type="text" class="form-control" id="s-cargo" list="cargo-list" placeholder="Chọn hoặc nhập..." required oninput="app.calcBrokerage()">
                            <datalist id="cargo-list">
                                ${AppData.getCargos().map(c => `<option value="${c}"></option>`).join('')}
                            </datalist>
                        </div>
                        <div class="form-group"><label class="form-label">Cảng xếp (Đi)</label>
                            <input type="text" class="form-control" id="s-p-load" list="port-list" placeholder="Chọn hoặc nhập..." required oninput="app.calcBrokerage()">
                        </div>
                    </div>
                    <div class="form-group"><label class="form-label">Cảng dỡ (Đến)</label>
                        <input type="text" class="form-control" id="s-p-dis" list="port-list" placeholder="Chọn hoặc nhập..." required oninput="app.calcBrokerage()">
                        <datalist id="port-list">
                            ${AppData.getPorts().map(p => `<option value="${p}"></option>`).join('')}
                        </datalist>
                    </div>
                    <div class="grid-3">
                        <div class="form-group"><label class="form-label">Ngày xếp hàng</label><input type="date" class="form-control" id="s-start" required onchange="app.calcShipmentAllocations()"></div>
                        <div class="form-group"><label class="form-label">Ngày dỡ hàng</label><input type="date" class="form-control" id="s-end" required onchange="app.calcShipmentAllocations()"></div>
                        <div class="form-group"><label class="form-label">Tháng hạch toán</label><input type="month" class="form-control" id="s-report-month" title="Mặc định lấy theo tháng của ngày xếp hàng"></div>
                    </div>
                    <div class="grid-5" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">
                        <div class="form-group"><label class="form-label">Khối lượng (Tấn)</label><input type="number" step="any" class="form-control" id="s-qty" oninput="app.calcShipmentFinance()" required></div>
                        <div class="form-group"><label class="form-label">Đơn giá thực</label><input type="number" step="any" class="form-control" id="s-rate" oninput="app.calcShipmentFinance()" required></div>
                        <div class="form-group"><label class="form-label">Tiền gửi (VND/tấn)</label><input type="number" step="any" class="form-control" id="s-markup" oninput="app.calcShipmentFinance()" value="0"></div>
                        <div class="form-group"><label class="form-label">Giá dầu chuyến</label><input type="number" step="any" class="form-control" id="s-fuel-p" oninput="app.calcShipmentFinance()" value="20000"></div>
                        <div class="form-group"><label class="form-label">Tỷ lệ Thuế VAT (%)</label><input type="number" step="any" class="form-control" id="s-commission-rate" oninput="app.calcShipmentFinance()" value="28"></div>
                    </div>
                    <div class="grid-3" style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:var(--radius-md); margin-bottom:1.5rem;">
                        <div><small class="stat-label">Doanh thu Hóa đơn</small><div id="val-rev-inv" style="font-weight:bold; color:var(--info);">0 đ</div></div>
                        <div><small class="stat-label">Doanh thu thực tế</small><div id="val-rev-real" style="font-weight:bold; color:var(--secondary);">0 đ</div></div>
                        <div><small class="stat-label">Tiền gửi lại khách</small><div id="val-refund" style="font-weight:bold; color:var(--warning);">0 đ</div></div>
                    </div>
                    
                    <h4 style="margin-bottom:1rem; color:var(--accent);">Chi phí Chuyến hàng</h4>
                    <div class="grid-4">
                        <div class="form-group"><label class="form-label">Số giờ chạy (Auto)</label><input type="number" class="form-control" id="s-c-hours" readonly style="background:rgba(0,0,0,0.3);"></div>
                        <div class="form-group"><label class="form-label">Tiền dầu DO (Auto)</label><input type="number" class="form-control" id="s-c-fuel" readonly style="background:rgba(0,0,0,0.3);"></div>
                        <div class="form-group"><label class="form-label">Tiền dầu LO</label><input type="number" class="form-control" id="s-c-fuel-lo" oninput="app.handleFuelLOInput()"></div>
                        <div class="form-group"><label class="form-label">Đại lý 2 đầu cảng</label><input type="number" class="form-control" id="s-c-agent" oninput="app.calcShipmentFinance()"></div>
                    </div>
                    
                    <div class="grid-4" style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:var(--radius-sm); border:1px dashed var(--border-color); margin-bottom:1rem;">
                        <div class="form-group"><label class="form-label" style="color:var(--secondary);">Lương TV (Alloc)</label><input type="number" class="form-control" id="s-c-sal" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--secondary);">Tiền ăn (Alloc)</label><input type="number" class="form-control" id="s-c-food" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--secondary);">Bảo hiểm (Alloc)</label><input type="number" class="form-control" id="s-c-ins" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--secondary);">CP khác Cty cấp (Alloc)</label><input type="number" class="form-control" id="s-c-m-other" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                    </div>

                    <div class="grid-4" style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:var(--radius-sm); border:1px dashed var(--border-color); margin-bottom:1rem;">
                        <div class="form-group"><label class="form-label" style="color:var(--info);">Vật tư Cty cấp (Alloc)</label><input type="number" class="form-control" id="s-c-m-mat-company" readonly style="background:rgba(0,0,0,0.3); color:var(--info);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--warning);">Vật tư Tàu chi (Alloc)</label><input type="number" class="form-control" id="s-c-m-mat-vessel" readonly style="background:rgba(0,0,0,0.3); color:var(--warning);"></div>
                        <div class="form-group"><label class="form-label">Tàu chi 2 đầu cảng (Tàu chi)</label><input type="number" class="form-control" id="s-c-vessel-2ends" oninput="app.calcShipmentFinance()"></div>
                        <div class="form-group"><label class="form-label">Tiền Bông (Auto/Tàu chi)</label><input type="number" class="form-control" id="s-c-brokerage" oninput="app.calcShipmentFinance()"></div>
                    </div>

                    <div class="grid-2" style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:var(--radius-sm); border:1px dashed var(--border-color); margin-bottom:1rem; display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                        <div class="form-group" style="margin:0;"><label class="form-label" style="color:var(--warning);">Lãi vay Ngân hàng (Alloc)</label><input type="number" class="form-control" id="s-c-loan-interest" readonly style="background:rgba(0,0,0,0.3); color:var(--warning);"></div>
                        <div class="form-group" style="margin:0;"><label class="form-label" style="color:var(--warning);">Lãi vay ngoài (Alloc)</label><input type="number" class="form-control" id="s-c-loan-interest-external" readonly style="background:rgba(0,0,0,0.3); color:var(--warning);"></div>
                    </div>

                    <div class="grid-6" style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:var(--radius-sm); border:1px dashed var(--border-color); margin-bottom:1rem; display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;">
                        <div class="form-group"><label class="form-label" style="color:var(--secondary); font-size:0.75rem;">Lên đà TG (Alloc)</label><input type="number" class="form-control" id="s-c-docking-int" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--secondary); font-size:0.75rem;">Lên đà ĐK (Alloc)</label><input type="number" class="form-control" id="s-c-docking-per" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--secondary); font-size:0.75rem;">Đăng kiểm (Alloc)</label><input type="number" class="form-control" id="s-c-registry-ann" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--secondary); font-size:0.75rem;">Khấu hao (Alloc)</label><input type="number" class="form-control" id="s-c-depreciation" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--secondary); font-size:0.75rem;">BH thân vỏ (Alloc)</label><input type="number" class="form-control" id="s-c-hull-insurance" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--secondary); font-size:0.75rem;">Sửa chữa lớn (Alloc)</label><input type="number" class="form-control" id="s-c-large-repair" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                    </div>

                    <div class="grid-4">
                        <div class="form-group">
                            <label class="form-label">Hệ số hàng (A)</label>
                            <select class="form-control" id="s-coef-a" onchange="app.calcBrokerage()">
                                <option value="2.0">Hàng rời/Than/Cát (2.0)</option>
                                <option value="1.0">Niêm phong (1.0)</option>
                                <option value="1.5">Kiện bịch (1.5)</option>
                                <option value="2.0">Đầu bao (2.0)</option>
                            </select>
                        </div>
                        <div class="form-group"><label class="form-label">Tiền VAT (Tự tính)</label><input type="number" class="form-control" id="s-c-vat" readonly style="background:rgba(0,0,0,0.3);"></div>
                        <div class="form-group"><label class="form-label">Hoa tiêu, Tàu lai, Phí cảng</label><input type="number" class="form-control" id="s-c-port-fees" oninput="app.calcShipmentFinance()"></div>
                        <div class="form-group"><label class="form-label">Chi phí khác tàu chi</label><input type="number" class="form-control" id="s-c-others" oninput="app.calcShipmentFinance()"></div>
                    </div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary" style="width:100%;">Lưu Chuyến Hàng</button></div>
                </form>
            </div>
        `;
    },

    hr: (activeTab = 'all') => {
        let employees = AppData.getEmployees();
        const vessels = AppData.getVessels();
        
        // Filter by tab
        if (activeTab !== 'all') {
            employees = employees.filter(e => e.department === activeTab);
        }

        const tabs = [
            { id: 'all', name: 'Tất cả' },
            { id: 'VP', name: 'Khối Quản lý' },
            ...vessels.map(v => ({ id: v.id, name: `Tàu ${v.name}` }))
        ];

        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Quản lý Nhân sự</h1>
                        <p class="page-subtitle">Hồ sơ nhân viên & thuyền viên</p>
                    </div>
                    <button class="btn btn-primary" onclick="app.openEmployeeModal()">
                        <i class="fa-solid fa-plus"></i> Thêm Nhân sự
                    </button>
                </div>
                
                <div class="tabs" style="display:flex; gap:10px; margin-bottom: 20px; overflow-x: auto;">
                    ${tabs.map(t => `
                        <button class="btn ${activeTab === t.id ? 'btn-primary' : 'btn-outline'}" onclick="app.hrTab = '${t.id}'; app.navigate('hr')">
                            ${t.name}
                        </button>
                    `).join('')}
                </div>

                <div class="glass-card">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Họ và Tên</th>
                                    <th>Chức vụ</th>
                                    ${activeTab === 'all' ? '<th>Bộ phận/Tàu</th>' : ''}
                                    <th>Lương cơ bản</th>
                                    <th>PC Giao nhận</th>
                                    <th>Thưởng HT CV</th>
                                    <th>Tiền ăn ca</th>
                                    <th>Điện thoại</th>
                                    <th>Trang phục</th>
                                    <th>Xăng xe</th>
                                    <th>Giảm trừ bản thân</th>
                                    <th>NPT</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employees.map(e => `
                                    <tr>
                                        <td>
                                            <strong>${e.name}</strong><br>
                                            <small style="color:var(--text-muted)">
                                                ${e.joinDate ? 'Vào: ' + e.joinDate.split('-').reverse().join('/') : ''} 
                                                ${e.leaveDate ? `<span style="color:var(--rose-light)">Nghỉ: ${e.leaveDate.split('-').reverse().join('/')}</span>` : ''}
                                            </small>
                                        </td>
                                        <td>${e.role || ''}</td>
                                        ${activeTab === 'all' ? `<td><span class="badge badge-outline">${e.department || 'VP'}</span></td>` : ''}
                                        <td>${AppData.formatCurrency(e.basicSalary || 0)}</td>
                                        <td>${AppData.formatCurrency(e.deliveryAllowance || 0)}</td>
                                        <td>${AppData.formatCurrency(e.completionBonus || 0)}</td>
                                        <td>${AppData.formatCurrency(e.mealAllowance || 0)}</td>
                                        <td>${AppData.formatCurrency(e.phoneAllowance || 0)}</td>
                                        <td>${AppData.formatCurrency(e.clothingAllowance || 0)}</td>
                                        <td>${AppData.formatCurrency(e.transportAllowance || 0)}</td>
                                        <td>${AppData.formatCurrency(e.personalDeduction || 0)}</td>
                                        <td style="text-align:center;">${e.dependents || 0}</td>
                                        <td>
                                            <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.editEmployee('${e.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                            <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.deleteEmployee('${e.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                                ${employees.length === 0 ? `<tr><td colspan="${activeTab === 'all' ? 13 : 12}" style="text-align:center;">Chưa có dữ liệu nhân sự</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    employeeModal: (e = {}) => {
        const vessels = AppData.getVessels();
        return `
            <div class="modal-header">
                <h3>${e.id ? 'Cập nhật Nhân sự' : 'Thêm Nhân sự'}</h3>
                <button class="modal-close" onclick="app.closeModal('employee-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveEmployee('${e.id || ''}');">
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Họ và Tên</label><input type="text" class="form-control" id="emp-name" value="${e.name || ''}" required></div>
                        <div class="form-group"><label class="form-label">Điện thoại</label><input type="text" class="form-control" id="emp-phone" value="${e.phone || ''}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Chức vụ</label><input type="text" class="form-control" id="emp-role" value="${e.role || ''}" required></div>
                        <div class="form-group">
                            <label class="form-label">Bộ phận / Tàu</label>
                            <select class="form-control" id="emp-department">
                                <option value="VP" ${e.department === 'VP' ? 'selected' : ''}>Quản lý (VP)</option>
                                ${vessels.map(v => `<option value="${v.id}" ${e.department === v.id ? 'selected' : ''}>Tàu ${v.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Lương cơ bản (VND)</label><input type="number" step="any" class="form-control" id="emp-basic-salary" value="${e.basicSalary || ''}"></div>
                        <div class="form-group"><label class="form-label">Mức lương thực tế (VND)</label><input type="number" step="any" class="form-control" id="emp-actual-salary" value="${e.actualSalary || ''}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Tiền ăn ca (VND)</label><input type="number" step="any" class="form-control" id="emp-meal-allowance" value="${e.mealAllowance || ''}"></div>
                        <div class="form-group"><label class="form-label">Điện thoại (VND)</label><input type="number" step="any" class="form-control" id="emp-phone-allowance" value="${e.phoneAllowance || ''}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Phụ cấp trang phục (VND)</label><input type="number" step="any" class="form-control" id="emp-clothing-allowance" value="${e.clothingAllowance || ''}"></div>
                        <div class="form-group"><label class="form-label">Xăng xe, đi lại (VND)</label><input type="number" step="any" class="form-control" id="emp-transport-allowance" value="${e.transportAllowance || ''}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Giảm trừ bản thân (VND)</label><input type="number" step="any" class="form-control" id="emp-personal-deduction" value="${e.personalDeduction || 15500000}"></div>
                        <div class="form-group"><label class="form-label">Số lượng NPT</label><input type="number" class="form-control" id="emp-dependents" value="${e.dependents || 0}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Tiền bảo hiểm (VND)</label><input type="number" step="any" class="form-control" id="emp-insurance" value="${e.insurance || 0}"></div>
                        <div class="form-group"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Phụ cấp giao nhận (VND)</label><input type="number" step="any" class="form-control" id="emp-delivery-allowance" value="${e.deliveryAllowance || 0}"></div>
                        <div class="form-group"><label class="form-label">Thưởng hoàn thành CV (VND)</label><input type="number" step="any" class="form-control" id="emp-completion-bonus" value="${e.completionBonus || 0}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Ngày vào làm / Nhập tàu</label><input type="date" class="form-control" id="emp-join" value="${e.joinDate || ''}"></div>
                        <div class="form-group"><label class="form-label">Ngày nghỉ (Nếu có)</label><input type="date" class="form-control" id="emp-leave" value="${e.leaveDate || ''}"></div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <textarea class="form-control" id="emp-notes" rows="2">${e.notes || ''}</textarea>
                    </div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary" style="width:100%;">${e.id ? 'Lưu Thay Đổi' : 'Thêm Nhân Sự'}</button></div>
                </form>
            </div>
        `;
    },

    salary: (month, department, activeTab = 'thucte') => {
        // Defaults
        if (!month) month = new Date().toISOString().substring(0, 7);
        if (!department) department = 'VP';

        const vessels = AppData.getVessels();
        let employees = AppData.getEmployees().filter(e => e.department === department);
        
        // Get or initialize timesheet for this month & department
        let timesheet = AppData.getTimesheet(month, department);
        if (!timesheet) {
            timesheet = {
                month: month,
                department: department,
                attendance: {},
                voyageCount: 0
            };
        }

        // Get days in month
        const [yyyy, mm] = month.split('-');
        const daysInMonth = new Date(yyyy, mm, 0).getDate();

        let headerHTML = `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Chấm công & Tính lương</h1>
                        <p class="page-subtitle">Quản lý ngày công và tính lương thực lĩnh hàng tháng</p>
                    </div>
                </div>

                <div class="tabs" style="display:flex; gap:10px; margin-bottom: 20px;">
                    <button class="btn ${activeTab === 'thucte' ? 'btn-primary' : 'btn-outline'}" onclick="app.salaryTab = 'thucte'; app.loadSalaryView()">Lương Thực Tế</button>
                    <button class="btn ${activeTab === 'chungtu' ? 'btn-primary' : 'btn-outline'}" onclick="app.salaryTab = 'chungtu'; app.loadSalaryView()">Lương Chứng Từ</button>
                </div>

                <div class="glass-card" style="margin-bottom: 1.5rem; padding: 1.5rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <div class="form-group" style="margin: 0; min-width: 200px;">
                        <label class="form-label">Chọn tháng</label>
                        <input type="month" class="form-control" id="sal-month" value="${month}" onchange="app.loadSalaryView()">
                    </div>
                    <div class="form-group" style="margin: 0; min-width: 200px;">
                        <label class="form-label">Chọn Tàu / Bộ phận</label>
                        <select class="form-control" id="sal-department" onchange="app.loadSalaryView()">
                            <option value="VP" ${department === 'VP' ? 'selected' : ''}>Quản lý (VP)</option>
                            ${vessels.map(v => `<option value="${v.id}" ${department === v.id ? 'selected' : ''}>Tàu ${v.name}</option>`).join('')}
                        </select>
                    </div>
                    ${activeTab === 'chungtu' ? `
                    <div class="form-group" style="margin: 0; min-width: 150px;">
                        <label class="form-label">Số chuyến trong tháng</label>
                        <input type="number" class="form-control" id="sal-voyage-count" value="${timesheet.voyageCount || 0}" onchange="app.updateVoyageCount()">
                    </div>
                    ` : ''}
                </div>
        `;

        if (activeTab === 'thucte') {
            // Calculate columns for days
            let daysHeader = '';
            for (let i = 1; i <= daysInMonth; i++) {
                daysHeader += `<th style="width:25px; padding:0.25rem; text-align:center; font-size:0.75rem;">${i}</th>`;
            }

            let totalActual = 0;
            let totalInsurance = 0;
            let totalPayment = 0;

            let tableHTML = `
                <div class="glass-card" style="overflow-x: auto;">
                    <div class="table-container">
                        <table class="table" style="min-width: 1200px;">
                            <thead>
                                <tr>
                                    <th style="min-width: 150px; position: sticky; left: 0; z-index: 2; background: var(--bg-card);">Nhân sự</th>
                                    ${daysHeader}
                                    <th style="text-align:center;">Số công</th>
                                    <th style="text-align:right;">Mức lương thực tế</th>
                                    <th style="text-align:right;">Bảo hiểm</th>
                                    <th style="text-align:right; color:var(--success);">Thực lĩnh</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            tableHTML += employees.map(e => {
                // Make sure attendance array exists for employee
                if (!timesheet.attendance[e.id]) {
                    // Default: all days ticked
                    timesheet.attendance[e.id] = Array(daysInMonth).fill(true);
                } else {
                    // Adjust array length if month changes (e.g. 30 vs 31 days)
                    while(timesheet.attendance[e.id].length < daysInMonth) timesheet.attendance[e.id].push(true);
                    if (timesheet.attendance[e.id].length > daysInMonth) timesheet.attendance[e.id] = timesheet.attendance[e.id].slice(0, daysInMonth);
                }

                const att = timesheet.attendance[e.id];
                const workingDays = att.filter(Boolean).length;
                const actual = Number(e.actualSalary) || 0;
                const insurance = Number(e.insurance) || 0;
                
                // Calculate formula
                const payment = Math.round((actual / daysInMonth) * workingDays - insurance);

                totalActual += actual;
                totalInsurance += insurance;
                totalPayment += payment;

                let daysCells = '';
                for (let i = 0; i < daysInMonth; i++) {
                    const isChecked = att[i] ? 'checked' : '';
                    daysCells += `
                        <td style="padding:0.25rem; text-align:center;">
                            <input type="checkbox" ${isChecked} style="cursor:pointer;" onchange="app.toggleAttendanceDay('${e.id}', ${i}, this.checked)">
                        </td>
                    `;
                }

                return `
                    <tr>
                        <td style="position: sticky; left: 0; z-index: 1; background: var(--bg-card);">
                            <strong>${e.name}</strong><br>
                            <small style="color:var(--text-muted)">${e.role || ''}</small>
                        </td>
                        ${daysCells}
                        <td style="text-align:center; font-weight:600; color:var(--info);">${workingDays}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(actual)}</td>
                        <td style="text-align:right; color:var(--rose-light);">${AppData.formatCurrency(insurance)}</td>
                        <td style="text-align:right; font-weight:700; color:var(--success);">${AppData.formatCurrency(payment)}</td>
                    </tr>
                `;
            }).join('');

            if (employees.length > 0) {
                tableHTML += `
                                <tr>
                                    <td style="position: sticky; left: 0; z-index: 1; background: var(--bg-card); font-weight: 700; text-transform: uppercase;">Tổng cộng</td>
                                    <td colspan="${daysInMonth + 1}" style="background: rgba(255, 255, 255, 0.03);"></td>
                                    <td style="text-align:right; font-weight:700; color:var(--info); background: rgba(255, 255, 255, 0.03);">${AppData.formatCurrency(totalActual)}</td>
                                    <td style="text-align:right; font-weight:700; color:var(--rose-light); background: rgba(255, 255, 255, 0.03);">${AppData.formatCurrency(totalInsurance)}</td>
                                    <td style="text-align:right; font-weight:700; color:var(--success); background: rgba(255, 255, 255, 0.03);">${AppData.formatCurrency(totalPayment)}</td>
                                </tr>
                `;
            } else {
                tableHTML += `<tr><td colspan="${daysInMonth + 5}" style="text-align:center; padding: 2rem;">Không có nhân sự nào trong bộ phận này</td></tr>`;
            }

            tableHTML += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            `;
            
            return headerHTML + tableHTML;
        } else {
            // Render Documented Salary Table
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

            const voyageCount = Number(timesheet.voyageCount) || 0;

            let docTableHTML = `
                <div class="glass-card" style="overflow-x: auto;">
                    <div class="table-container">
                        <table class="table" style="min-width: 2500px; font-size: 0.8rem;">
                            <thead>
                                <tr>
                                    <th rowspan="2" style="position: sticky; left: 0; z-index: 3; background: var(--bg-card); min-width: 50px;">STT</th>
                                    <th rowspan="2" style="position: sticky; left: 50px; z-index: 3; background: var(--bg-card); min-width: 150px;">Họ và tên</th>
                                    <th rowspan="2" style="position: sticky; left: 200px; z-index: 3; background: var(--bg-card); min-width: 100px;">Chức vụ</th>
                                    <th rowspan="2">Lương cơ bản</th>
                                    <th colspan="4" style="text-align: center;">Hỗ trợ</th>
                                    <th rowspan="2">Phụ cấp giao nhận</th>
                                    <th rowspan="2">Thưởng HT CV</th>
                                    <th rowspan="2" style="color:var(--info);">Tổng lương thực tế</th>
                                    <th rowspan="2">Thu nhập chịu thuế</th>
                                    <th rowspan="2">Giảm trừ bản thân</th>
                                    <th rowspan="2">Số NPT</th>
                                    <th rowspan="2">Giảm trừ NPT</th>
                                    <th rowspan="2">Mức lương đóng BHXH</th>
                                    <th colspan="4" style="text-align: center;">Trích vào CP DN</th>
                                    <th colspan="4" style="text-align: center;">Trích vào lương NV</th>
                                    <th rowspan="2">Thu nhập tính thuế</th>
                                    <th rowspan="2">Thuế TNCN phải nộp</th>
                                    <th rowspan="2" style="color:var(--success);">Lương còn lại</th>
                                </tr>
                                <tr>
                                    <th>Tiền ăn ca</th>
                                    <th>Điện thoại</th>
                                    <th>Trang phục</th>
                                    <th>Xăng xe, đi lại</th>
                                    <th>BHXH (17.5%)</th>
                                    <th>BHYT (3%)</th>
                                    <th>BHTN (1%)</th>
                                    <th>Cộng</th>
                                    <th>BHXH (8%)</th>
                                    <th>BHYT (1.5%)</th>
                                    <th>BHTN (1%)</th>
                                    <th>Cộng</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            let sumActualTotal = 0;
            let sumRemaining = 0;

            employees.forEach((e, idx) => {
                const basic = Number(e.basicSalary) || 0;
                const meal = Number(e.mealAllowance) || 0;
                const phone = Number(e.phoneAllowance) || 0;
                const clothing = Number(e.clothingAllowance) || 0;
                const transport = Number(e.transportAllowance) || 0;
                const delivery = (Number(e.deliveryAllowance) || 0) * voyageCount;
                const bonus = (Number(e.completionBonus) || 0) * voyageCount;

                const actualTotal = basic + meal + phone + clothing + transport + delivery + bonus;
                // Income subject to tax: actual total - non-taxable allowances (transport is NOT deducted here per business rule)
                const taxableIncome = Math.max(0, actualTotal - meal - phone - clothing);
                
                const personalDeduction = Number(e.personalDeduction) || 15500000;
                const dependents = Number(e.dependents) || 0;
                const dependentDeduction = dependents * 6200000;

                const insuranceBase = Number(e.insurance) || 0;

                // DN
                const dnBhxh = insuranceBase * 0.175;
                const dnBhyt = insuranceBase * 0.03;
                const dnBhtn = insuranceBase * 0.01;
                const dnTotal = dnBhxh + dnBhyt + dnBhtn;

                // NV
                const nvBhxh = insuranceBase * 0.08;
                const nvBhyt = insuranceBase * 0.015;
                const nvBhtn = insuranceBase * 0.01;
                const nvTotal = nvBhxh + nvBhyt + nvBhtn;

                // Tax calculation
                const assessableIncome = Math.max(0, taxableIncome - personalDeduction - dependentDeduction - nvTotal);
                const tax = calcTax(assessableIncome);

                // Remaining
                const remaining = actualTotal - nvTotal - tax;

                sumActualTotal += actualTotal;
                sumRemaining += remaining;

                docTableHTML += `
                    <tr>
                        <td style="position: sticky; left: 0; z-index: 2; background: var(--bg-card);">${idx + 1}</td>
                        <td style="position: sticky; left: 50px; z-index: 2; background: var(--bg-card);"><strong>${e.name}</strong></td>
                        <td style="position: sticky; left: 200px; z-index: 2; background: var(--bg-card);">${e.role || ''}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(basic)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(meal)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(phone)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(clothing)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(transport)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(delivery)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(bonus)}</td>
                        <td style="text-align:right; font-weight:700; color:var(--info);">${AppData.formatCurrency(actualTotal)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(taxableIncome)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(personalDeduction)}</td>
                        <td style="text-align:center;">${dependents}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(dependentDeduction)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(insuranceBase)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(dnBhxh)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(dnBhyt)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(dnBhtn)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(dnTotal)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(nvBhxh)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(nvBhyt)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(nvBhtn)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(nvTotal)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(assessableIncome)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(tax)}</td>
                        <td style="text-align:right; font-weight:700; color:var(--success);">${AppData.formatCurrency(remaining)}</td>
                    </tr>
                `;
            });

            if (employees.length === 0) {
                docTableHTML += `<tr><td colspan="27" style="text-align:center; padding: 2rem;">Không có nhân sự nào trong bộ phận này</td></tr>`;
            }

            docTableHTML += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            `;

            return headerHTML + docTableHTML;
        }
    },

    company: () => {
        const c = AppData.getCompany();
        return `
            <div class="view-section">
                <div class="page-header"><div><h1 class="page-title">Master Data</h1><p class="page-subtitle">Thông tin công ty và quản lý đội tàu</p></div></div>
                <div class="grid-2">
                    <div class="glass-card">
                        <h3>Thông tin Công ty</h3>
                        <form onsubmit="event.preventDefault(); app.saveCompany();" style="margin-top:1rem;">
                            <div class="form-group"><label class="form-label">Tên công ty</label><input type="text" class="form-control" id="c-name" value="${c.name}"></div>
                            <div class="form-group"><label class="form-label">Địa chỉ</label><input type="text" class="form-control" id="c-addr" value="${c.address}"></div>
                            <div class="form-group"><label class="form-label">Mã số thuế</label><input type="text" class="form-control" id="c-tax" value="${c.taxId}"></div>
                            <div class="form-group"><label class="form-label">Ngân hàng</label><textarea class="form-control" id="c-bank">${c.bankInfo}</textarea></div>
                            
                            <h4 style="margin: 1.5rem 0 1rem; color: var(--primary-light);">Số dư đầu kỳ</h4>
                            <div class="grid-2">
                                <div class="form-group"><label class="form-label">ABbank</label><input type="number" step="any" class="form-control" id="bal-abbank" value="${(c.openingBalances && c.openingBalances['ABbank']) || 0}"></div>
                                <div class="form-group"><label class="form-label">Viettinbank</label><input type="number" step="any" class="form-control" id="bal-viettin" value="${(c.openingBalances && c.openingBalances['Viettinbank']) || 0}"></div>
                            </div>
                            <div class="grid-2">
                                <div class="form-group"><label class="form-label">Cá nhân</label><input type="number" step="any" class="form-control" id="bal-ca-nhan" value="${(c.openingBalances && c.openingBalances['Tài khoản cá nhân']) || 0}"></div>
                                <div class="form-group"><label class="form-label">Tiền mặt</label><input type="number" step="any" class="form-control" id="bal-tien-mat" value="${(c.openingBalances && c.openingBalances['Tiền mặt']) || 0}"></div>
                            </div>
                            
                            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Cập nhật hồ sơ & Số dư</button>
                        </form>
                    </div>
                    <div class="glass-card">
                        <h3>Danh sách Tàu & Thuyền trưởng</h3>
                        <div class="table-container" style="margin-top:1rem;">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Tên tàu</th>
                                        <th>Tải trọng</th>
                                        <th>Thuyền trưởng & SĐT</th>
                                        <th>Quản lý & SĐT</th>
                                        <th>Định mức</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${AppData.state.vessels.map(v => `
                                        <tr>
                                            <td><strong>${v.name}</strong></td>
                                            <td><span class="badge badge-success" style="font-weight:600;">${v.capacity ? (Number(v.capacity).toLocaleString('vi-VN') + ' tấn') : '---'}</span></td>
                                            <td>
                                                <strong>${v.captain || '---'}</strong>
                                                ${v.captainPhone ? `<br><small style="color:var(--text-muted)"><i class="fa-solid fa-phone"></i> ${v.captainPhone}</small>` : ''}
                                            </td>
                                            <td>
                                                <strong>${v.manager || '---'}</strong>
                                                ${v.managerPhone ? `<br><small style="color:var(--text-muted)"><i class="fa-solid fa-phone"></i> ${v.managerPhone}</small>` : ''}
                                            </td>
                                            <td><span class="badge badge-outline">${Math.round(v.fuelRate)} L/h</span></td>
                                            <td>
                                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.editVessel('${v.id}')" title="Sửa thông tin tàu"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="glass-card" style="margin-top: 1.5rem; grid-column: span 2;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
                            <h3 style="margin: 0;">Sao lưu & Khôi phục Dữ liệu (Excel)</h3>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <button class="btn btn-primary" onclick="app.exportSystemBackup()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                                    <i class="fa-solid fa-cloud-arrow-down"></i> Tải File Backup (Tất cả)
                                </button>
                                <div style="position: relative; overflow: hidden; display: inline-block;">
                                    <button class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                                        <i class="fa-solid fa-cloud-arrow-up"></i> Khôi phục Toàn bộ
                                    </button>
                                    <input type="file" accept=".xlsx, .xls" onchange="app.importSystemBackupExcel(event)" style="position: absolute; font-size: 100px; opacity: 0; right: 0; top: 0; cursor: pointer;">
                                </div>
                            </div>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">
                            Hệ thống hỗ trợ tải xuống toàn bộ dữ liệu chỉ trong 1 file Excel (gồm nhiều sheet). Bạn có thể khôi phục nhanh bằng cách tải lại file backup này hoặc từng phần riêng biệt bên dưới.
                        </p>
                        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                                <label class="form-label" style="font-weight: bold; color: var(--info);"><i class="fa-solid fa-file-import"></i> Khôi phục Chuyến Hàng</label>
                                <input type="file" id="import-shipments-file" accept=".xlsx, .xls" class="form-control" style="font-size: 0.8rem; padding: 6px;" onchange="app.importShipmentsExcel(event)">
                            </div>
                            <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                                <label class="form-label" style="font-weight: bold; color: var(--warning);"><i class="fa-solid fa-file-import"></i> Khôi phục Báo Cáo Dầu</label>
                                <input type="file" id="import-fuel-file" accept=".xlsx, .xls" class="form-control" style="font-size: 0.8rem; padding: 6px;" onchange="app.importFuelExcel(event)">
                            </div>
                            <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                                <label class="form-label" style="font-weight: bold; color: var(--secondary);"><i class="fa-solid fa-file-import"></i> Khôi phục Giao dịch Thu/Chi</label>
                                <input type="file" id="import-transactions-file" accept=".xlsx, .xls" class="form-control" style="font-size: 0.8rem; padding: 6px;" onchange="app.importTransactionsExcel(event)">
                            </div>
                            <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                                <label class="form-label" style="font-weight: bold; color: var(--accent);"><i class="fa-solid fa-file-import"></i> Khôi phục Chi phí Tàu</label>
                                <input type="file" id="import-vessel-expenses-file" accept=".xlsx, .xls" class="form-control" style="font-size: 0.8rem; padding: 6px;" onchange="app.importVesselExpensesExcel(event)">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    debts: (currentTab = 'customer') => {
        // Helper to normalize names
        const normalizeName = (name) => {
            if (!name) return '';
            return name.normalize('NFC').trim().replace(/\s+/g, ' ');
        };

        // Helper to remove accents for robust matching
        const removeAccents = (str) => {
            if (!str) return '';
            return str.normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[đĐ]/g, 'd')
                      .toLowerCase();
        };

        // Helper to smart match customer (accents insensitive)
        const matchCustomer = (t, customerName) => {
            const normPartner = removeAccents(t.partner);
            const normCust = removeAccents(customerName);
            if (normPartner && (normPartner === normCust || normPartner.includes(normCust) || normCust.includes(normPartner))) {
                return true;
            }
            const normContent = removeAccents(t.content);
            if (normContent && (normContent.includes(normCust) || normContent.includes(removeAccents(customerName)))) {
                return true;
            }
            return false;
        };

        let content = '';

        if (currentTab === 'customer') {
            const shipments = AppData.getShipments();
            const transactions = AppData.getTransactions();

            // 1. Get all unique customer names from shipments only
            const customerNamesSet = new Set();
            shipments.forEach(s => {
                if (s.customer) {
                    customerNamesSet.add(normalizeName(s.customer));
                }
            });

            const customerNames = Array.from(customerNamesSet).sort();

            // If no selected customer yet, pick the first one by default
            if (!app.selectedDebtCustomer && customerNames.length > 0) {
                app.selectedDebtCustomer = customerNames[0];
            }

            // 2. Compute details for each customer
            const customersDebtData = customerNames.map(custName => {
                const custShipments = shipments.filter(s => normalizeName(s.customer) === custName);
                
                // Transactions matching this customer
                const custTrans = transactions.filter(t => matchCustomer(t, custName));

                // Shipments summary
                let totalRealRevenue = 0;
                let totalInvoiceRevenue = 0;
                let totalInvoiceRevenueCompleted = 0;
                let totalInvoiceRevenueIncomplete = 0;
                let totalRefundAmount = 0;
                custShipments.forEach(s => {
                    totalRealRevenue += Number(s.revenueReal) || 0;
                    const val = Number(s.revenueInvoice) || 0;
                    totalInvoiceRevenue += val;
                    if (s.contractNo && s.contractNo.trim() !== '') {
                        totalInvoiceRevenueCompleted += val;
                    } else {
                        totalInvoiceRevenueIncomplete += val;
                    }
                    totalRefundAmount += Number(s.refundAmount) || 0;
                });

                // Payments received (thu) and paid out (chi) from transactions
                let totalPaid = 0;
                let totalReturned = 0;
                custTrans.forEach(t => {
                    if (t.category === 'CVC') {
                        totalPaid += Number(t.thu) || 0;
                        totalReturned += Number(t.chi) || 0;
                    }
                });

                // Calculations
                const openingDebt = AppData.state.company.customerOpeningDebts ? (Number(AppData.state.company.customerOpeningDebts[custName]) || 0) : 0;
                const invoiceDebtCompleted = openingDebt + totalInvoiceRevenueCompleted - totalPaid;
                const invoiceDebtIncomplete = totalInvoiceRevenueIncomplete;
                const invoiceDebt = invoiceDebtCompleted + invoiceDebtIncomplete;
                const unpaidRefund = totalRefundAmount - totalReturned;
                const netReceived = totalPaid - totalReturned;
                const actualDebt = openingDebt + totalRealRevenue - netReceived;

                return {
                    name: custName,
                    shipmentsCount: custShipments.length,
                    openingDebt,
                    totalRealRevenue,
                    totalInvoiceRevenue,
                    totalInvoiceRevenueCompleted,
                    totalInvoiceRevenueIncomplete,
                    totalRefundAmount,
                    totalPaid,
                    totalReturned,
                    invoiceDebt,
                    invoiceDebtCompleted,
                    invoiceDebtIncomplete,
                    unpaidRefund,
                    netReceived,
                    actualDebt,
                    shipments: custShipments,
                    transactions: custTrans
                };
            });

            // Compute system-wide totals
            let sysTotalReal = 0;
            let sysTotalInvoice = 0;
            let sysTotalRefund = 0;
            let sysTotalPaid = 0;
            let sysTotalReturned = 0;
            let sysTotalOpeningDebt = 0;
            let sysInvoiceDebtCompleted = 0;
            let sysInvoiceDebtIncomplete = 0;
            customersDebtData.forEach(c => {
                sysTotalReal += c.totalRealRevenue;
                sysTotalInvoice += c.totalInvoiceRevenue;
                sysTotalRefund += c.totalRefundAmount;
                sysTotalPaid += c.totalPaid;
                sysTotalReturned += c.totalReturned;
                sysTotalOpeningDebt += c.openingDebt;
                sysInvoiceDebtCompleted += c.invoiceDebtCompleted;
                sysInvoiceDebtIncomplete += c.invoiceDebtIncomplete;
            });
            const sysInvoiceDebt = sysInvoiceDebtCompleted + sysInvoiceDebtIncomplete;
            const sysUnpaidRefund = sysTotalRefund - sysTotalReturned;
            const sysNetReceived = sysTotalPaid - sysTotalReturned;
            const sysActualDebt = sysTotalOpeningDebt + sysTotalReal - sysNetReceived;

            // Get details of the currently selected customer
            const selectedData = customersDebtData.find(c => c.name === app.selectedDebtCustomer) || customersDebtData[0] || {
                name: '', shipmentsCount: 0, openingDebt: 0, totalRealRevenue: 0, totalInvoiceRevenue: 0,
                totalInvoiceRevenueCompleted: 0, totalInvoiceRevenueIncomplete: 0, totalRefundAmount: 0,
                totalPaid: 0, totalReturned: 0, invoiceDebt: 0, invoiceDebtCompleted: 0, invoiceDebtIncomplete: 0,
                unpaidRefund: 0, actualDebt: 0, shipments: [], transactions: []
            };

            // Compute monthly breakdown for selected customer
            const monthlyBreakdown = {};
            // Group shipments by month
            selectedData.shipments.forEach(s => {
                const date = s.dateStart || s.dateEnd || '';
                const m = date.substring(0, 7);
                if (!m) return;
                if (!monthlyBreakdown[m]) {
                    monthlyBreakdown[m] = { realRev: 0, invRev: 0, refund: 0, paid: 0, returned: 0 };
                }
                monthlyBreakdown[m].realRev += Number(s.revenueReal) || 0;
                monthlyBreakdown[m].invRev += Number(s.revenueInvoice) || 0;
                monthlyBreakdown[m].refund += Number(s.refundAmount) || 0;
            });

            // Group transactions by month
            selectedData.transactions.forEach(t => {
                if (t.category !== 'CVC') return;
                const date = t.date || '';
                const m = date.substring(0, 7);
                if (!m) return;
                if (!monthlyBreakdown[m]) {
                    monthlyBreakdown[m] = { realRev: 0, invRev: 0, refund: 0, paid: 0, returned: 0 };
                }
                monthlyBreakdown[m].paid += Number(t.thu) || 0;
                monthlyBreakdown[m].returned += Number(t.chi) || 0;
            });

            const sortedMonths = Object.keys(monthlyBreakdown).sort((a, b) => b.localeCompare(a));

            content = `
                <!-- Global Summary Cards -->
                <div class="grid-4" style="margin-bottom: 2.5rem;">
                    <div class="glass-card stat-card" style="border-left: 4px solid var(--info);">
                        <span class="stat-label">Tổng Doanh Thu Hoá Đơn</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: var(--info);">${AppData.formatCurrency(sysTotalInvoice)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Tổng phát sinh hoá đơn</div>
                    </div>
                    <div class="glass-card stat-card" style="border-left: 4px solid #f59e0b;">
                        <span class="stat-label">Tổng Khách Hàng Đã Trả</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: #f59e0b;">${AppData.formatCurrency(sysTotalPaid)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Đã trả lại ĐT (Chi): ${AppData.formatCurrency(sysTotalReturned)}</div>
                    </div>
                    <div class="glass-card stat-card" style="border-left: 4px solid var(--accent);">
                        <span class="stat-label">Tổng Công Nợ Phải Thu</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: var(--accent);">${AppData.formatCurrency(sysInvoiceDebt)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">
                            Đầu kỳ: ${AppData.formatCurrency(sysTotalOpeningDebt)}<br>
                            HT: <span style="color: #10b981; font-weight: 600;">${AppData.formatCurrency(sysInvoiceDebtCompleted)}</span> | 
                            Chưa HT: <span style="color: #fbbf24; font-weight: 600;">${AppData.formatCurrency(sysInvoiceDebtIncomplete)}</span>
                        </div>
                    </div>
                    <div class="glass-card stat-card" style="border-left: 4px solid var(--warning);">
                        <span class="stat-label">Quỹ Tiền Gửi Còn Lại</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: var(--warning);">${AppData.formatCurrency(sysUnpaidRefund)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Tổng TG phát sinh: ${AppData.formatCurrency(sysTotalRefund)}</div>
                    </div>
                </div>

                <!-- Customer Cards Grid -->
                <div style="margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-users" style="color:var(--primary-light); margin-right: 0.5rem;"></i>Danh sách Khách hàng</h3>
                    <div class="grid-4" style="gap: 1rem;">
                        ${customersDebtData.map(cust => {
                            const isSelected = cust.name === selectedData.name;
                            let badgeClass = 'badge-success';
                            let debtStatusText = 'Hoàn thành';
                            if (cust.actualDebt > 100000000) {
                                badgeClass = 'badge-danger';
                                debtStatusText = 'Nợ cao';
                            } else if (cust.actualDebt > 0) {
                                badgeClass = 'badge-warning';
                                debtStatusText = 'Có nợ';
                            }
                            
                            return `
                                <div class="glass-card ${isSelected ? 'active-card' : ''}" 
                                     onclick="app.changeDebtCustomer('${cust.name}')" 
                                     style="cursor: pointer; position: relative; border: ${isSelected ? '2px solid var(--primary-light)' : '1px solid rgba(255,255,255,0.05)'}; padding: 1.2rem; transition: all 0.2s;">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                                        <h4 style="margin: 0; font-size: 1.1rem; color: ${isSelected ? 'var(--primary-light)' : 'var(--text-main)'};">${cust.name}</h4>
                                        <span class="badge ${badgeClass}" style="font-size: 0.7rem; padding: 2px 6px;">${debtStatusText}</span>
                                    </div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                                        <div>Số chuyến:</div>
                                        <div style="text-align: right; font-weight: bold; color: var(--text-main);">${cust.shipmentsCount}</div>
                                        
                                        <div>DT thực tế:</div>
                                        <div style="text-align: right; font-weight: 600; color: var(--text-muted);">${(cust.totalRealRevenue / 1e6).toFixed(1)}M</div>

                                        <div>Đã trả (Thu):</div>
                                        <div style="text-align: right; font-weight: 600; color: var(--secondary);">${(cust.totalPaid / 1e6).toFixed(1)}M</div>
                                        
                                        <div>Tiền gửi dư:</div>
                                        <div style="text-align: right; font-weight: 600; color: var(--warning);">${(cust.unpaidRefund / 1e6).toFixed(1)}M</div>

                                        <div>Nợ HT:</div>
                                        <div style="text-align: right; font-weight: 600; color: #10b981;">${(cust.invoiceDebtCompleted / 1e6).toFixed(1)}M</div>

                                        <div>Nợ Chưa HT:</div>
                                        <div style="text-align: right; font-weight: 600; color: #fbbf24;">${(cust.invoiceDebtIncomplete / 1e6).toFixed(1)}M</div>

                                        <div style="border-top: 1px solid rgba(255,255,255,0.05); margin-top: 4px; padding-top: 4px; font-weight: bold;">Tổng công nợ:</div>
                                        <div style="border-top: 1px solid rgba(255,255,255,0.05); margin-top: 4px; padding-top: 4px; text-align: right; font-weight: bold; color: var(--accent);">${(cust.invoiceDebt / 1e6).toFixed(1)}M</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                        ${(() => {
                            const hq = customersDebtData.find(c => c.name.toLowerCase().includes('hoàng quyên'));
                            const na = customersDebtData.find(c => c.name.toLowerCase().includes('ngọc anh'));
                            if (hq || na) {
                                const combinedCount = (hq?.shipmentsCount || 0) + (na?.shipmentsCount || 0);
                                const combinedPaid = (hq?.totalPaid || 0) + (na?.totalPaid || 0);
                                const combinedRefund = (hq?.unpaidRefund || 0) + (na?.unpaidRefund || 0);
                                const combinedDebt = (hq?.invoiceDebt || 0) + (na?.invoiceDebt || 0);
                                const combinedDebtCompleted = (hq?.invoiceDebtCompleted || 0) + (na?.invoiceDebtCompleted || 0);
                                const combinedDebtIncomplete = (hq?.invoiceDebtIncomplete || 0) + (na?.invoiceDebtIncomplete || 0);
                                const combinedRealRev = (hq?.totalRealRevenue || 0) + (na?.totalRealRevenue || 0);
                                return `
                                    <div class="glass-card" style="grid-column: span 2; border: 2px dashed rgba(255, 255, 255, 0.2); padding: 1.2rem; background: rgba(14, 165, 233, 0.05);">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                                            <h4 style="margin: 0; font-size: 1.1rem; color: var(--info);">Tổng hợp Ngọc Anh + Hoàng Quyên</h4>
                                            <span class="badge badge-info" style="font-size: 0.7rem; padding: 2px 6px;">Tổng hợp chung</span>
                                        </div>
                                        <div style="font-size: 0.85rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; align-items: center;">
                                            <div>Số chuyến:</div>
                                            <div style="font-weight: bold; color: var(--text-main); font-size: 1rem;">${combinedCount}</div>
                                            
                                            <div style="text-align: right;">DT thực tế:</div>
                                            <div style="text-align: right; font-weight: 600; color: var(--text-muted); font-size: 1rem;">${(combinedRealRev / 1e6).toFixed(1)}M</div>

                                            <div>Đã trả (Thu):</div>
                                            <div style="font-weight: 600; color: var(--secondary); font-size: 1rem;">${(combinedPaid / 1e6).toFixed(1)}M</div>
                                            
                                            <div style="text-align: right;">Tiền gửi dư:</div>
                                            <div style="text-align: right; font-weight: 600; color: var(--warning); font-size: 1rem;">${(combinedRefund / 1e6).toFixed(1)}M</div>

                                            <div>Nợ HT:</div>
                                            <div style="font-weight: 600; color: #10b981; font-size: 1rem;">${(combinedDebtCompleted / 1e6).toFixed(1)}M</div>

                                            <div style="text-align: right;">Nợ Chưa HT:</div>
                                            <div style="text-align: right; font-weight: 600; color: #fbbf24; font-size: 1rem;">${(combinedDebtIncomplete / 1e6).toFixed(1)}M</div>

                                            <div style="grid-column: span 3; text-align: right; font-weight: bold; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 4px; padding-top: 8px;">Tổng Công nợ:</div>
                                            <div style="text-align: right; font-weight: bold; color: var(--accent); font-size: 1rem; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 4px; padding-top: 8px;">${(combinedDebt / 1e6).toFixed(1)}M</div>
                                        </div>
                                    </div>
                                `;
                            }
                            return '';
                        })()}
                    </div>
                </div>

                <!-- Detailed Selected Customer Panel -->
                ${selectedData.name ? `
                    <div class="glass-card" style="border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(30, 33, 43, 0.4);">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1.2rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                            <div>
                                <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--primary-light); font-weight: 700; letter-spacing: 0.05em;">Chi tiết đối tác</span>
                                <h2 style="margin: 0; font-size: 1.6rem; color: var(--text-main);">${selectedData.name}</h2>
                                
                                <!-- Opening Debt Input Field -->
                                <div style="margin-top: 0.75rem; display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.03); padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;"><i class="fa-solid fa-hourglass-start" style="margin-right: 4px;"></i>Nợ đầu kỳ:</span>
                                    <input type="number" 
                                           id="cust-opening-debt" 
                                           class="form-control" 
                                           value="${selectedData.openingDebt}" 
                                           style="width: 140px; font-size: 0.8rem; padding: 2px 6px; height: 26px; text-align: right; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-main); font-weight: 600;"
                                           placeholder="0">
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">đ</span>
                                    <button onclick="app.updateCustomerOpeningDebt('${selectedData.name}')" 
                                            class="btn" 
                                            style="padding: 2px 10px; font-size: 0.75rem; height: 26px; line-height: 22px; display: inline-flex; align-items: center; gap: 4px; background: var(--primary); border: none; color: white; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
                                        <i class="fa-solid fa-floppy-disk"></i> Lưu
                                    </button>
                                </div>
                            </div>
                            <div style="display: flex; gap: 1.5rem; text-align: right; align-items: center;">
                                <div>
                                    <small class="stat-label">Nợ Đầu Kỳ</small>
                                    <div style="font-weight: 700; color: #f59e0b;">${AppData.formatCurrency(selectedData.openingDebt)}</div>
                                </div>
                                <div style="border-left: 1px solid var(--border-color); padding-left: 1.5rem;">
                                    <small class="stat-label">Tổng Hóa Đơn</small>
                                    <div style="font-weight: 700; color: var(--text-main);">${AppData.formatCurrency(selectedData.totalInvoiceRevenue)}</div>
                                </div>
                                <div style="border-left: 1px solid var(--border-color); padding-left: 1.5rem;">
                                    <small class="stat-label">Đã Trả (Thu)</small>
                                    <div style="font-weight: 700; color: var(--secondary);">${AppData.formatCurrency(selectedData.totalPaid)}</div>
                                </div>
                                <div style="border-left: 1px solid var(--border-color); padding-left: 1.5rem; display: flex; flex-direction: column; justify-content: center;">
                                    <small class="stat-label">Công Nợ Còn Lại</small>
                                    <div style="font-weight: 700; color: var(--accent); line-height: 1.2;">${AppData.formatCurrency(selectedData.invoiceDebt)}</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                                        HT: <span style="color: #10b981; font-weight: 600;">${AppData.formatCurrency(selectedData.invoiceDebtCompleted)}</span> | 
                                        Chưa HT: <span style="color: #fbbf24; font-weight: 600;">${AppData.formatCurrency(selectedData.invoiceDebtIncomplete)}</span>
                                    </div>
                                </div>
                                <div style="border-left: 1px solid var(--border-color); padding-left: 1.5rem;">
                                    <small class="stat-label">Tiền Gửi (Còn lại)</small>
                                    <div style="font-weight: 700; color: var(--warning);">${AppData.formatCurrency(selectedData.unpaidRefund)}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Sub-navigation tabs or section layout -->
                        <div style="margin-top: 1.5rem;">
                            <!-- 1. Voyage ledger -->
                            <h3 style="font-size: 1.2rem; margin-bottom: 1rem;"><i class="fa-solid fa-ship" style="color:var(--primary-light); margin-right: 0.5rem;"></i>1. Phát sinh Doanh thu từng chuyến</h3>
                            <div class="double-scroll-wrapper" id="debts-voyages-scroll-wrapper" style="margin-bottom: 2.5rem;">
                                <div class="top-scrollbar" style="overflow-x: auto; overflow-y: hidden; height: 8px; margin-bottom: 6px; border-radius: 4px; display: none;">
                                    <div class="top-scrollbar-dummy" style="height: 1px;"></div>
                                </div>
                                <div class="table-container">
                                    ${console.log('DEBUG DATA', selectedData.transactions, selectedData.shipments) || ''}
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>STT</th>
                                                <th>Tàu & Chuyến</th>
                                                <th>Hợp đồng</th>
                                                <th>Số ngày</th>
                                                <th style="text-align: right;">Sản lượng (Tấn)</th>
                                                <th style="text-align: right;">Đơn giá</th>
                                                <th style="text-align: right;">Doanh thu hóa đơn</th>
                                                <th style="text-align: right; color: var(--text-muted);">Doanh thu thực tế</th>
                                                <th style="text-align: right; color: var(--secondary);">Số tiền đã trả</th>
                                                <th style="text-align: right; color: var(--accent);">Công nợ còn lại</th>
                                                <th style="text-align: right;">Tiền gửi phát sinh</th>
                                                <th style="text-align: right; color: var(--warning);">Tiền gửi còn lại</th>
                                            </tr>
                                        </thead>
                                    <tbody>
                                        ${(() => {
                                            const sortedShipments = [...selectedData.shipments].sort((a, b) => {
                                                const dateA = a.dateStart || '';
                                                const dateB = b.dateStart || '';
                                                if (dateA !== dateB) return dateA.localeCompare(dateB);
                                                return (a.contractNo || '').localeCompare(b.contractNo || '', undefined, {numeric: true, sensitivity: 'base'});
                                            });
                                            
                                            const explicitPaidMap = {};
                                            const explicitReturnedMap = {};
                                            let unallocatedPaid = 0;
                                            let unallocatedReturned = 0;
                                            
                                            selectedData.transactions.forEach(t => {
                                                if (t.category === 'CVC') {
                                                    const matchedShipment = sortedShipments.find(s => s.contractNo && s.contractNo === t.contractNo);
                                                    if (matchedShipment) {
                                                        const sid = matchedShipment.id;
                                                        explicitPaidMap[sid] = (explicitPaidMap[sid] || 0) + (Number(t.thu) || 0);
                                                        explicitReturnedMap[sid] = (explicitReturnedMap[sid] || 0) + (Number(t.chi) || 0);
                                                    } else {
                                                        unallocatedPaid += (Number(t.thu) || 0);
                                                        unallocatedReturned += (Number(t.chi) || 0);
                                                    }
                                                }
                                            });

                                            let remainingPaid = unallocatedPaid;
                                            remainingPaid -= selectedData.openingDebt;
                                            if (remainingPaid < 0) remainingPaid = 0;
                                        
                                            let remainingReturned = unallocatedReturned;
                                        
                                            let totalRemainingDebt = 0;
                                            let totalRemainingRefund = 0;
                                            let totalPaidForThis = 0;
                                            
                                            const rows = sortedShipments.map((s, idx) => {
                                                const vessel = AppData.getVessel(s.vesselId);
                                                
                                                let invoiceAmt = Number(s.revenueInvoice) || 0;
                                                let explicitPaid = explicitPaidMap[s.id] || 0;
                                                let paidForThis = explicitPaid;
                                                
                                                if (remainingPaid > 0) {
                                                    if (idx === sortedShipments.length - 1) {
                                                        paidForThis += remainingPaid;
                                                        remainingPaid = 0;
                                                    } else if (invoiceAmt > paidForThis) {
                                                        let gap = invoiceAmt - paidForThis;
                                                        let add = Math.min(remainingPaid, gap);
                                                        paidForThis += add;
                                                        remainingPaid -= add;
                                                    }
                                                }
                                                let remainingDebt = invoiceAmt - paidForThis;
                                                totalRemainingDebt += remainingDebt;
                                                totalPaidForThis += paidForThis;
                                                
                                                let refundAmt = Number(s.refundAmount) || 0;
                                                let explicitReturned = explicitReturnedMap[s.id] || 0;
                                                let returnedForThis = explicitReturned;
                                                
                                                if (remainingReturned > 0) {
                                                    if (idx === sortedShipments.length - 1) {
                                                        returnedForThis += remainingReturned;
                                                        remainingReturned = 0;
                                                    } else if (refundAmt > returnedForThis) {
                                                        let gap = refundAmt - returnedForThis;
                                                        let add = Math.min(remainingReturned, gap);
                                                        returnedForThis += add;
                                                        remainingReturned -= add;
                                                    }
                                                }
                                                let remainingRefund = refundAmt - returnedForThis;
                                                totalRemainingRefund += remainingRefund;
                                                
                                                const hasContract = s.contractNo && s.contractNo.trim() !== '';
                                                const badgeHtml = hasContract
                                                    ? `<span class="badge badge-success" style="font-size: 0.7rem; padding: 2px 6px; margin-left: 6px;">Đã hoàn thành</span>`
                                                    : `<span class="badge badge-warning" style="font-size: 0.7rem; padding: 2px 6px; margin-left: 6px;">Chưa hoàn thành</span>`;

                                                return `
                                                    <tr onclick="app.editShipment('${s.id}')" title="Click để nhập liệu/chỉnh sửa chuyến hàng" style="cursor: pointer;">
                                                        <td>${idx + 1}</td>
                                                        <td><strong>${vessel ? vessel.name : s.vesselId}</strong> <span class="badge badge-outline">Chuyến ${s.voyageNo}</span></td>
                                                        <td>
                                                            <code style="font-size: 1.1rem; font-weight: bold; padding: 4px 8px; color: var(--primary-light); background: rgba(255,255,255,0.08); border-radius: 4px;">${s.contractNo || '---'}</code>
                                                            ${badgeHtml}
                                                        </td>
                                                        <td><strong>${AppData.calcDays(s.dateStart, s.dateEnd)}</strong> ngày</td>
                                                        <td style="text-align: right; font-weight: 500;">${s.qty ? s.qty.toLocaleString('vi-VN') : 0}</td>
                                                        <td style="text-align: right;">${s.rate ? s.rate.toLocaleString('vi-VN') : '0'}</td>
                                                        <td style="text-align: right; font-weight: 600; color: var(--info);">${AppData.formatCurrency(invoiceAmt)}</td>
                                                        <td style="text-align: right; font-size: 0.85rem; color: var(--text-muted);">${AppData.formatCurrency(s.revenueReal)}</td>
                                                        <td style="text-align: right; font-weight: 600; color: var(--secondary);">${AppData.formatCurrency(paidForThis)}</td>
                                                        <td style="text-align: right; font-weight: 700; color: ${remainingDebt > 0 ? 'var(--accent)' : 'var(--text-muted)'};">${AppData.formatCurrency(remainingDebt)}</td>
                                                        <td style="text-align: right; font-weight: 500;">${AppData.formatCurrency(refundAmt)}</td>
                                                        <td style="text-align: right; font-weight: 700; color: ${remainingRefund > 0 ? 'var(--warning)' : 'var(--text-muted)'};">${AppData.formatCurrency(remainingRefund)}</td>
                                                    </tr>
                                                `;
                                            }).join('');
                                            
                                            const summaryRow = selectedData.shipments.length === 0 ? `
                                                <tr><td colspan="10" style="text-align: center; color: var(--text-muted);">Không có dữ liệu chuyến hàng nào cho khách hàng này.</td></tr>
                                            ` : `
                                                <tr style="font-weight: 700; background: rgba(255,255,255,0.03); border-top: 2px solid var(--border-color);">
                                                    <td colspan="4">TỔNG CỘNG PHÁT SINH CHUYẾN</td>
                                                    <td style="text-align: right;">${selectedData.shipments.reduce((sum, s) => sum + (s.qty || 0), 0).toLocaleString('vi-VN')}</td>
                                                    <td></td>
                                                    <td style="text-align: right; color: var(--info);">${AppData.formatCurrency(selectedData.totalInvoiceRevenue)}</td>
                                                    <td style="text-align: right; color: var(--text-muted);">${AppData.formatCurrency(selectedData.totalRealRevenue)}</td>
                                                    <td style="text-align: right; color: var(--secondary);">${AppData.formatCurrency(totalPaidForThis)}</td>
                                                    <td style="text-align: right; color: var(--accent);">${AppData.formatCurrency(totalRemainingDebt)}</td>
                                                    <td style="text-align: right;">${AppData.formatCurrency(selectedData.totalRefundAmount)}</td>
                                                    <td style="text-align: right; color: var(--warning);">${AppData.formatCurrency(totalRemainingRefund)}</td>
                                                </tr>
                                            `;
                                            return rows + summaryRow;
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                            <div class="grid-2" style="margin-bottom: 2.5rem; gap: 1.5rem;">
                                <!-- 2. Payments ledger -->
                                <div>
                                    <h3 style="font-size: 1.2rem; margin-bottom: 1rem;"><i class="fa-solid fa-receipt" style="color:var(--secondary); margin-right: 0.5rem;"></i>2. Giao dịch Thanh toán & Trả lại (CVC)</h3>
                                    <div class="table-container">
                                        <table class="table" style="font-size: 0.85rem;">
                                            <thead>
                                                <tr>
                                                    <th>Ngày</th>
                                                    <th>Nội dung</th>
                                                    <th>Tài khoản</th>
                                                    <th style="text-align: right;">Khách trả (+)</th>
                                                    <th style="text-align: right;">Trả lại (-)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${selectedData.transactions.filter(t => t.category === 'CVC').map(t => `
                                                    <tr onclick="app.editTransaction('${t.id}')" title="Click để xem chi tiết / chỉnh sửa giao dịch" style="cursor: pointer;">
                                                        <td>${t.date.split('-').reverse().join('/')}</td>
                                                        <td>${t.content}</td>
                                                        <td><span class="badge badge-outline" style="font-size: 0.7rem;">${t.account}</span></td>
                                                        <td style="text-align: right; color: var(--secondary); font-weight: bold;">
                                                            ${t.thu > 0 ? '+' + AppData.formatCurrency(t.thu) : '---'}
                                                        </td>
                                                        <td style="text-align: right; color: var(--accent); font-weight: bold;">
                                                            ${t.chi > 0 ? '-' + AppData.formatCurrency(t.chi) : '---'}
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                                ${selectedData.transactions.filter(t => t.category === 'CVC').length === 0 ? `
                                                    <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Chưa phát sinh giao dịch thanh toán nào.</td></tr>
                                                ` : `
                                                    <tr style="font-weight: 700; background: rgba(255,255,255,0.03); border-top: 1px solid var(--border-color);">
                                                        <td colspan="3">TỔNG GIAO DỊCH PHÁT SINH</td>
                                                        <td style="text-align: right; color: var(--secondary);">${AppData.formatCurrency(selectedData.totalPaid)}</td>
                                                        <td style="text-align: right; color: var(--accent);">${AppData.formatCurrency(selectedData.totalReturned)}</td>
                                                    </tr>
                                                `}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <!-- 3. Monthly Summary -->
                                <div>
                                    <h3 style="font-size: 1.2rem; margin-bottom: 1rem;"><i class="fa-solid fa-calendar-check" style="color:#f59e0b; margin-right: 0.5rem;"></i>3. Tổng hợp Công nợ theo Tháng</h3>
                                    <div class="table-container">
                                        <table class="table" style="font-size: 0.85rem;">
                                            <thead>
                                                <tr>
                                                    <th>Tháng</th>
                                                    <th style="text-align: right;">Doanh thu Hoá đơn</th>
                                                    <th style="text-align: right;">Tiền gửi trả lại</th>
                                                    <th style="text-align: right;">Khách trả trong tháng</th>
                                                    <th style="text-align: right;">Công nợ ròng phát sinh</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${sortedMonths.map(m => {
                                                    const data = monthlyBreakdown[m];
                                                    const monthlyNetDebt = data.invRev - data.refund - data.paid + data.returned;
                                                    return `
                                                        <tr>
                                                            <td><strong>Tháng ${m.split('-').reverse().join('/')}</strong></td>
                                                            <td style="text-align: right; font-weight: 500;">${AppData.formatCurrency(data.invRev)}</td>
                                                            <td style="text-align: right; color: var(--accent);">${AppData.formatCurrency(data.refund)}</td>
                                                            <td style="text-align: right; color: var(--secondary); font-weight: 600;">${AppData.formatCurrency(data.paid)}</td>
                                                            <td style="text-align: right; font-weight: 700; color: ${monthlyNetDebt >= 0 ? 'var(--accent)' : 'var(--secondary)'};">
                                                                ${AppData.formatCurrency(monthlyNetDebt)}
                                                            </td>
                                                        </tr>
                                                    `;
                                                }).join('')}
                                                ${sortedMonths.length === 0 ? `
                                                    <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Không có dữ liệu tổng hợp tháng.</td></tr>
                                                ` : ''}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.75rem; font-style: italic; line-height: 1.4;">
                                        * Công nợ ròng phát sinh tháng = (Doanh thu Hoá đơn - Tiền gửi phát sinh) - (Khách trả - Tiền gửi đã nhận lại). <br>
                                        Nếu âm (-), khách hàng đang trả dư nợ cũ phát sinh từ các tháng trước.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="glass-card" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                        <i class="fa-solid fa-users-slash" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>Không tìm thấy khách hàng nào có dữ liệu công nợ trong hệ thống.</p>
                    </div>
                `}
            `;
        } else if (currentTab === 'supplier') {
            const supplierDebts = AppData.getSupplierDebts();
            
            let sysTotalPurchased = 0;
            let sysTotalPaid = 0;
            
            supplierDebts.forEach(s => {
                sysTotalPurchased += s.totalPurchased;
                sysTotalPaid += s.totalPaid;
            });
            const sysDebt = sysTotalPurchased - sysTotalPaid;

            content = `
                <!-- Global Summary Cards -->
                <div class="grid-3" style="margin-bottom: 2.5rem;">
                    <div class="glass-card stat-card" style="border-left: 4px solid var(--info);">
                        <span class="stat-label">Tổng Phát Sinh Mua Dầu</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: var(--info);">${AppData.formatCurrency(sysTotalPurchased)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Giá trị cấp dầu</div>
                    </div>
                    <div class="glass-card stat-card" style="border-left: 4px solid #f59e0b;">
                        <span class="stat-label">Tổng Đã Thanh Toán</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: #f59e0b;">${AppData.formatCurrency(sysTotalPaid)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Đã trả NCC</div>
                    </div>
                    <div class="glass-card stat-card" style="border-left: 4px solid var(--accent);">
                        <span class="stat-label">Tổng Công Nợ Còn Lại</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: var(--accent);">${AppData.formatCurrency(sysDebt)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Nợ NCC dầu</div>
                    </div>
                </div>

                <div class="glass-card">
                    <h3 style="color: var(--accent); margin-bottom: 1rem;"><i class="fa-solid fa-truck-droplet"></i> Báo cáo Công nợ Nhà Cung Cấp Nhiên liệu</h3>
                    
                    ${supplierDebts.length === 0 ? '<p style="text-align:center; color:var(--text-muted); padding: 2rem;">Chưa có dữ liệu nhà cung cấp dầu.</p>' : `
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Nhà Cung Cấp</th>
                                    <th style="text-align: right;">Tổng Tiền Mua Dầu (VNĐ)</th>
                                    <th style="text-align: right;">Đã Thanh Toán (VNĐ)</th>
                                    <th style="text-align: right;">Còn Nợ (VNĐ)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${supplierDebts.map(s => `
                                    <tr>
                                        <td><strong>${s.name}</strong></td>
                                        <td style="text-align: right; color: var(--info);">${AppData.formatCurrency(s.totalPurchased)}</td>
                                        <td style="text-align: right; color: var(--secondary);">${AppData.formatCurrency(s.totalPaid)}</td>
                                        <td style="text-align: right; font-weight: bold; color: var(--accent);">${AppData.formatCurrency(s.debt)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    `}
                </div>
            `;
        }

        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title"><i class="fa-solid fa-file-invoice-dollar" style="color:var(--primary-light); margin-right:0.5rem;"></i>Báo Cáo Công Nợ</h1>
                        <p class="page-subtitle">Quản lý, đối chiếu công nợ thực tế của khách hàng và nhà cung cấp</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary" onclick="app.printAllCustomersDebtReport()">
                            <i class="fa-solid fa-file-pdf"></i> Xuất Báo Cáo Tổng Hợp
                        </button>
                    </div>
                </div>

                <div style="display:flex; gap:1rem; border-bottom:1px solid var(--border-color); margin-bottom:1.5rem;">
                    <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${currentTab === 'customer' ? 'var(--primary-light)' : 'transparent'}; border-radius:0; font-weight: ${currentTab === 'customer' ? 'bold' : 'normal'};" onclick="app.navigate('debts', 'customer')">
                        <i class="fa-solid fa-users"></i> Công nợ Khách Hàng
                    </button>
                    <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${currentTab === 'supplier' ? 'var(--primary-light)' : 'transparent'}; border-radius:0; font-weight: ${currentTab === 'supplier' ? 'bold' : 'normal'};" onclick="app.navigate('debts', 'supplier')">
                        <i class="fa-solid fa-truck"></i> Công nợ NCC (Dầu)
                    </button>
                </div>

                ${content}
            </div>
        `;
    },
    vesselModal: (id) => {
        const v = AppData.getVessel(id);
        if (!v) return '';
        return `
            <div class="modal-header"><h3>Cập nhật thông tin Tàu ${v.name}</h3><button class="modal-close" onclick="app.closeModal('vessel-modal')">&times;</button></div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveVessel();">
                    <input type="hidden" id="v-id" value="${v.id}">
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Tên tàu</label><input type="text" class="form-control" id="v-name" value="${v.name}" disabled style="background:rgba(0,0,0,0.3); font-weight:bold; color:var(--success);"></div>
                        <div class="form-group"><label class="form-label">Tải trọng (Tấn)</label><input type="number" class="form-control" id="v-capacity" value="${v.capacity || ''}" required placeholder="Ví dụ: 3500"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Thuyền trưởng</label><input type="text" class="form-control" id="v-captain" value="${v.captain || ''}" required placeholder="Tên thuyền trưởng"></div>
                        <div class="form-group"><label class="form-label">Số điện thoại Thuyền trưởng</label><input type="text" class="form-control" id="v-captain-phone" value="${v.captainPhone || ''}" placeholder="Số điện thoại"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Quản lý tàu</label><input type="text" class="form-control" id="v-manager" value="${v.manager || ''}" placeholder="Tên người quản lý" required></div>
                        <div class="form-group"><label class="form-label">Số điện thoại Quản lý</label><input type="text" class="form-control" id="v-manager-phone" value="${v.managerPhone || ''}" placeholder="Số điện thoại"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Định mức nhiên liệu chung (Lít/giờ)</label><input type="number" class="form-control" id="v-fuel-rate" value="${v.fuelRate || ''}" required placeholder="Định mức tiêu hao"></div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary" style="width:100%;">Lưu thay đổi</button></div>
                </form>
            </div>
        `;
    },

    report: (s) => {
        const fuelDO = s.costs.fuelDO || 0;
        const fuelLO = s.costs.fuelLO || 0;
        const agent = s.costs.agent || 0;
        const vessel2ends = s.costs.vessel2ends || 0;
        const portFees = s.costs.portFees || 0;
        const brokerage = s.costs.brokerage || 0;
        const crewSalary = s.costs.crewSalary || 0;
        const crewFood = s.costs.crewFood || 0;
        const crewInsurance = s.costs.crewInsurance || 0;
        const materialCompany = s.costs.materialCompany || 0;
        const materialVessel = s.costs.materialVessel || 0;
        const loanInterest = s.costs.loanInterest || 0;
        const loanInterestExternal = s.costs.loanInterestExternal || 0;
        const monthlyOther = s.costs.monthlyOther || 0;
        const others = s.costs.others || 0;
        
        const depreciation = app.excludeDockingDepreciation ? 0 : (s.costs.depreciation || 0);
        const hullInsurance = s.costs.hullInsurance || 0;
        const dockingIntermediate = app.excludeDockingDepreciation ? 0 : (s.costs.dockingIntermediate || 0);
        const dockingPeriodic = app.excludeDockingDepreciation ? 0 : (s.costs.dockingPeriodic || 0);
        const registryAnnual = s.costs.registryAnnual || 0;
        const largeRepair = s.costs.largeRepair || 0;

        const deduc = fuelDO + fuelLO + agent + portFees;
        const vat = Math.round((0.08 * (s.revenueInvoice || s.revenueReal)) - (0.08 * deduc));
        
        const costSum = fuelDO + fuelLO + agent + vessel2ends + portFees + brokerage + crewSalary + crewFood + crewInsurance + materialCompany + materialVessel + loanInterest + loanInterestExternal + monthlyOther + others + depreciation + hullInsurance + dockingIntermediate + dockingPeriodic + registryAnnual + largeRepair + vat;
        const profit = s.revenueReal - costSum;
        const vessel = AppData.getVessel(s.vesselId);
        
        // Helper: format rows with percentage column
        const costRow = (label, value) => {
            const pct = costSum > 0 ? ((value / costSum) * 100).toFixed(1) : '0.0';
            return `
                <tr>
                    <td>${label}</td>
                    <td style="text-align: right; font-weight: 500;">${AppData.formatCurrency(value)}</td>
                    <td style="text-align: right; color: var(--text-muted); font-size: 0.85rem; width: 80px;">${pct}%</td>
                </tr>
            `;
        };

        // Gather all shipments for comparison
        const allShipments = AppData.getShipments() || [];
        
        // Compare with other shipments of the same vessel
        const sameVesselShipments = allShipments.filter(x => x.vesselId === s.vesselId && x.id !== s.id);
        
        // Compare with same route shipments (other vessels)
        const sameRouteShipments = allShipments.filter(x => x.portLoad === s.portLoad && x.portDischarge === s.portDischarge && x.id !== s.id);

        // Find top cost item (excluding total and vat)
        const costItemsList = [
            { label: 'Nhiên liệu DO', value: s.costs.fuelDO || 0 },
            { label: 'Nhiên liệu LO', value: s.costs.fuelLO || 0 },
            { label: 'Đại lý 2 đầu cảng', value: s.costs.agent || 0 },
            { label: 'Tàu chi 2 đầu cảng', value: s.costs.vessel2ends || 0 },
            { label: 'Phí cảng, Tàu lai, Hoa tiêu', value: s.costs.portFees || 0 },
            { label: 'Tiền Bông', value: s.costs.brokerage || 0 },
            { label: 'Lương thuyền viên', value: s.costs.crewSalary || 0 },
            { label: 'Tiền ăn thuyền viên', value: s.costs.crewFood || 0 },
            { label: 'Bảo hiểm nhân sự', value: s.costs.crewInsurance || 0 },
            { label: 'Vật tư Cty cấp', value: s.costs.materialCompany || 0 },
            { label: 'Vật tư Tàu chi', value: s.costs.materialVessel || 0 },
            { label: 'Lãi vay ngân hàng', value: s.costs.loanInterest || 0 },
            { label: 'Lãi vay ngoài', value: s.costs.loanInterestExternal || 0 },
            { label: 'Chi phí khác từ Cty', value: s.costs.monthlyOther || 0 },
            { label: 'Chi phí khác tàu chi', value: s.costs.others || 0 },
            { label: 'Khấu hao tài sản', value: s.costs.depreciation || 0 },
            { label: 'Bảo hiểm thân vỏ', value: s.costs.hullInsurance || 0 },
            { label: 'Lên đà trung gian', value: s.costs.dockingIntermediate || 0 },
            { label: 'Lên đà định kỳ', value: s.costs.dockingPeriodic || 0 },
            { label: 'Đăng kiểm hàng năm', value: s.costs.registryAnnual || 0 },
            { label: 'Sửa chữa lớn', value: s.costs.largeRepair || 0 }
        ];
        costItemsList.sort((a, b) => b.value - a.value);
        const topCost = costItemsList[0];
        const topCostPct = costSum > 0 ? ((topCost.value / costSum) * 100).toFixed(1) : '0';

        // Same Vessel Comparison HTML
        let sameVesselCompareHTML = '';
        if (sameVesselShipments.length > 0) {
            const avgCost = sameVesselShipments.reduce((sum, x) => {
                const xDeduc = (x.costs?.fuelDO || 0) + (x.costs?.fuelLO || 0) + (x.costs?.agent || 0) + (x.costs?.portFees || 0);
                const xVat = Math.round((0.08 * (x.revenueInvoice || x.revenueReal)) - (0.08 * xDeduc));
                const xBase = { ...x.costs };
                delete xBase.vat;
                const xTotal = Object.values(xBase).reduce((s, v) => s + (Number(v) || 0), 0) + xVat;
                return sum + xTotal;
            }, 0) / sameVesselShipments.length;
            
            const avgProfit = sameVesselShipments.reduce((sum, x) => {
                const xDeduc = (x.costs?.fuelDO || 0) + (x.costs?.fuelLO || 0) + (x.costs?.agent || 0) + (x.costs?.portFees || 0);
                const xVat = Math.round((0.08 * (x.revenueInvoice || x.revenueReal)) - (0.08 * xDeduc));
                const xBase = { ...x.costs };
                delete xBase.vat;
                const xTotal = Object.values(xBase).reduce((s, v) => s + (Number(v) || 0), 0) + xVat;
                return sum + (x.revenueReal - xTotal);
            }, 0) / sameVesselShipments.length;

            const costDiff = costSum - avgCost;
            const profitDiff = profit - avgProfit;
            
            sameVesselCompareHTML = `
                <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid var(--primary-light);">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--primary-light);">So sánh với trung bình các chuyến khác cùng tàu (${sameVesselShipments.length} chuyến):</h4>
                    <p style="margin: 0.25rem 0; font-size: 0.9rem;">• Chi phí chuyến này: <strong>${AppData.formatCurrency(costSum)}</strong> (${costDiff >= 0 ? '<span style="color:var(--rose-light);">cao hơn</span>' : '<span style="color:var(--secondary);">thấp hơn</span>'} trung bình <strong>${AppData.formatCurrency(Math.abs(costDiff))}</strong>).</p>
                    <p style="margin: 0.25rem 0; font-size: 0.9rem;">• Hiệu quả (lợi nhuận): <strong>${AppData.formatCurrency(profit)}</strong> (${profitDiff >= 0 ? '<span style="color:var(--secondary);">tốt hơn</span>' : '<span style="color:var(--rose-light);">thấp hơn</span>'} trung bình <strong>${AppData.formatCurrency(Math.abs(profitDiff))}</strong>).</p>
                </div>
            `;
        } else {
            sameVesselCompareHTML = `
                <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid var(--text-muted); opacity: 0.7;">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--text-muted);">So sánh với các chuyến khác cùng tàu:</h4>
                    <p style="margin: 0; font-size: 0.9rem; font-style: italic;">• Chưa có chuyến khác của cùng tàu này trong dữ liệu lịch sử để so sánh.</p>
                </div>
            `;
        }

        // Same Route Comparison HTML (Other Vessels)
        let sameRouteCompareHTML = '';
        const otherVesselsSameRoute = sameRouteShipments.filter(x => x.vesselId !== s.vesselId);
        if (otherVesselsSameRoute.length > 0) {
            const avgCost = otherVesselsSameRoute.reduce((sum, x) => {
                const xDeduc = (x.costs?.fuelDO || 0) + (x.costs?.fuelLO || 0) + (x.costs?.agent || 0) + (x.costs?.portFees || 0);
                const xVat = Math.round((0.08 * (x.revenueInvoice || x.revenueReal)) - (0.08 * xDeduc));
                const xBase = { ...x.costs };
                delete xBase.vat;
                const xTotal = Object.values(xBase).reduce((s, v) => s + (Number(v) || 0), 0) + xVat;
                return sum + xTotal;
            }, 0) / otherVesselsSameRoute.length;

            const avgDO = otherVesselsSameRoute.reduce((sum, x) => sum + (Number(x.costs?.fuelDO) || 0), 0) / otherVesselsSameRoute.length;
            
            const doDiff = (s.costs.fuelDO || 0) - avgDO;
            const costDiff = costSum - avgCost;
            
            sameRouteCompareHTML = `
                <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid var(--info);">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--info);">So sánh với tàu khác chạy cùng tuyến (${s.portLoad || 'Cảng xếp'} → ${s.portDischarge || 'Cảng dỡ'} - ${otherVesselsSameRoute.length} chuyến):</h4>
                    <p style="margin: 0.25rem 0; font-size: 0.9rem;">• Tổng chi phí: <strong>${AppData.formatCurrency(costSum)}</strong> (${costDiff >= 0 ? '<span style="color:var(--rose-light);">cao hơn</span>' : '<span style="color:var(--secondary);">thấp hơn</span>'} trung bình tuyến <strong>${AppData.formatCurrency(Math.abs(costDiff))}</strong>).</p>
                    <p style="margin: 0.25rem 0; font-size: 0.9rem;">• Tiêu thụ Dầu DO: <strong>${AppData.formatCurrency(s.costs.fuelDO)}</strong> (${doDiff >= 0 ? '<span style="color:var(--rose-light);">hao dầu hơn</span>' : '<span style="color:var(--secondary);">tiết kiệm dầu hơn</span>'} trung bình tuyến <strong>${AppData.formatCurrency(Math.abs(doDiff))}</strong>).</p>
                </div>
            `;
        } else {
            sameRouteCompareHTML = `
                <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid var(--text-muted); opacity: 0.7;">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--text-muted);">So sánh với tàu khác chạy cùng tuyến:</h4>
                    <p style="margin: 0; font-size: 0.9rem; font-style: italic;">• Tuyến đường ${s.portLoad || '---'} → ${s.portDischarge || '---'} chưa ghi nhận chuyến hàng của tàu khác để so sánh chéo.</p>
                </div>
            `;
        }

        return `
            <div class="report-container glass-panel" style="padding: 2rem; color: var(--text-main); font-family: 'Inter', sans-serif; max-height: 85vh; overflow-y: auto;">
                <div style="text-align: center; border-bottom: 2px solid var(--primary-light); padding-bottom: 1rem; margin-bottom: 2rem;">
                    <h2 style="color: var(--primary-light); text-transform: uppercase; margin-bottom: 0.25rem;">Báo cáo Kết quả Kinh doanh Chuyến hàng</h2>
                    <p style="margin: 0;">Mã chuyến: <strong>${s.voyageNo}</strong> | Tàu: <strong>${vessel ? vessel.name : s.vesselId}</strong></p>
                </div>

                <div class="grid-2" style="margin-bottom: 2rem; font-size: 0.95rem; line-height: 1.6;">
                    <div>
                        <p style="margin: 0.25rem 0;">Thời gian: <strong>${s.dateStart}</strong> đến <strong>${s.dateEnd}</strong> (<strong>${AppData.calcDays(s.dateStart, s.dateEnd)} ngày</strong>)</p>
                        <p style="margin: 0.25rem 0;">Hàng hóa: <strong>${s.cargo}</strong></p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0.25rem 0;">Khối lượng: <strong>${s.qty.toLocaleString()} tấn</strong> | Đơn giá: <strong>${AppData.formatCurrency(s.rate)} / tấn</strong></p>
                        <p style="margin: 0.25rem 0;">Tuyến đường: <strong>${s.portLoad || '---'} → ${s.portDischarge || '---'}</strong></p>
                    </div>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="border-left: 4px solid var(--info); padding-left: 10px; margin-bottom: 1rem; font-size: 1.1rem; color: var(--info);">I. DOANH THU</h3>
                    <table class="table" style="background: rgba(255,255,255,0.02);">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border-color); opacity: 0.8; font-size: 0.85rem;">
                                <th>Hạng mục</th>
                                <th style="text-align: right;">Số tiền</th>
                                <th style="text-align: right; width: 80px;">Tỷ trọng</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="font-weight: bold; background: rgba(0,255,100,0.05);">
                                <td>1. DOANH THU THỰC TẾ</td>
                                <td style="text-align: right; color: var(--secondary);">${AppData.formatCurrency(s.revenueReal)}</td>
                                <td style="text-align: right; color: var(--secondary);">100.0%</td>
                            </tr>
                            <tr>
                                <td>2. Tiền VAT (8% HĐ - 8% DO, LO, Đại lý, Cảng)</td>
                                <td style="text-align: right;">${AppData.formatCurrency(vat)}</td>
                                <td style="text-align: right; color: var(--text-muted); font-size: 0.85rem;">-</td>
                            </tr>
                            <tr style="font-weight: bold; border-top: 1px solid var(--border-color);">
                                <td>3. DOANH THU SAU KHI TRỪ VAT</td>
                                <td style="text-align: right; color: var(--info);">${AppData.formatCurrency(s.revenueReal - vat)}</td>
                                <td style="text-align: right; color: var(--info);">-</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="border-left: 4px solid var(--rose-light); padding-left: 10px; margin-bottom: 1rem; font-size: 1.1rem; color: var(--rose-light);">II. CHI PHÍ CHUYẾN HÀNG</h3>
                    <table class="table" style="background: rgba(255,255,255,0.02);">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border-color); opacity: 0.8; font-size: 0.85rem;">
                                <th>Khoản mục chi phí</th>
                                <th style="text-align: right;">Số tiền</th>
                                <th style="text-align: right; width: 80px;">Tỷ lệ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${costRow('1. Nhiên liệu DO', fuelDO)}
                            ${costRow('2. Nhiên liệu LO', fuelLO)}
                            ${costRow('3. Đại lý 2 đầu cảng', agent)}
                            ${costRow('4. Tàu chi 2 đầu cảng', vessel2ends)}
                            ${costRow('5. Phí cảng, Tàu lai, Hoa tiêu', portFees)}
                            ${costRow('6. Tiền Bông', brokerage)}
                            ${costRow('7. Lương thuyền viên (Phân bổ)', crewSalary)}
                            ${costRow('8. Tiền ăn thuyền viên (Phân bổ)', crewFood)}
                            ${costRow('9. Bảo hiểm (Phân bổ)', crewInsurance)}
                            ${costRow('10. Vật tư, sửa chữa Cty cấp (Phân bổ)', materialCompany)}
                            ${costRow('11. Vật tư, sửa chữa Tàu chi (Phân bổ)', materialVessel)}
                            ${costRow('12. Lãi vay ngân hàng (Phân bổ)', loanInterest)}
                            ${costRow('12b. Lãi vay ngoài (Phân bổ)', loanInterestExternal)}
                            ${costRow('13. Phân bổ chi phí khác từ Cty', monthlyOther)}
                            ${costRow('14. Chi phí khác tàu chi tại chuyến', others)}
                            ${costRow('15. Khấu hao tài sản (Phân bổ)', depreciation)}
                            ${costRow('16. Bảo hiểm thân vỏ (Phân bổ)', hullInsurance)}
                            ${costRow('17. Lên đà trung gian (Phân bổ)', dockingIntermediate)}
                            ${costRow('18. Lên đà định kỳ (Phân bổ)', dockingPeriodic)}
                            ${costRow('19. Đăng kiểm hàng năm (Phân bổ)', registryAnnual)}
                            ${costRow('20. Sửa chữa lớn (Phân bổ)', largeRepair)}
                            <tr style="font-weight: bold; background: rgba(255,0,100,0.05); border-top: 1px solid var(--border-color);">
                                <td>TỔNG CHI PHÍ</td>
                                <td style="text-align: right; color: var(--rose-light);">${AppData.formatCurrency(costSum)}</td>
                                <td style="text-align: right; color: var(--rose-light);">100.0%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style="background: var(--primary-dark); padding: 1.5rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--primary-light); margin-bottom: 2rem;">
                    <h2 style="margin: 0; font-size: 1.25rem;">III. LỢI NHUẬN RÒNG</h2>
                    <h2 style="margin: 0; font-size: 1.25rem; color: ${profit >= 0 ? 'var(--secondary)' : 'var(--rose-light)'};">${AppData.formatCurrency(profit)}</h2>
                </div>

                <div style="margin-bottom: 2rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                    <h3 style="border-left: 4px solid var(--warning); padding-left: 10px; margin-bottom: 1rem; font-size: 1.1rem; color: var(--warning);">IV. PHÂN TÍCH & SO SÁNH CHI PHÍ</h3>
                    
                    <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid var(--warning);">
                        <h4 style="margin: 0 0 0.5rem 0; color: var(--warning);">Hạng mục chiếm tỷ trọng cao nhất:</h4>
                        <p style="margin: 0; font-size: 0.95rem;">• Chi phí <strong>${topCost.label}</strong> đang chiếm tỷ trọng lớn nhất với <strong>${AppData.formatCurrency(topCost.value)}</strong>, chiếm tới <strong>${topCostPct}%</strong> tổng chi phí chuyến.</p>
                    </div>

                    ${sameVesselCompareHTML}

                    ${sameRouteCompareHTML}
                </div>
                
                <div style="margin-top: 2rem; text-align: center; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                    <button class="btn btn-outline" onclick="app.closeModal('report-modal')" style="margin-right: 10px;">Đóng Báo Cáo</button>
                    <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> In Báo Cáo</button>
                </div>
            </div>
        `;
    },

    vesselExpenseModal: (e = {}) => {
        const vessels = AppData.getVessels();
        const firstVesselId = e.vesselId || (vessels[0] ? vessels[0].id : '');
        
        // Find shipments for this vessel to link voyageNo
        const shipments = AppData.getShipments().filter(s => s.vesselId === firstVesselId);
        
        const categories = [
            'Tiền ăn & bồi dưỡng TV',
            'Tiền Bồi dưỡng',
            'Chi phí tại các đầu cảng',
            'Vật tư & CP khác'
        ];

        return `
            <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:1rem; margin-bottom:1rem;">
                <h3 class="modal-title" style="color:var(--accent); margin:0;"><i class="fa-solid fa-wallet"></i> ${e.id ? 'Cập Nhật' : 'Thêm'} Chi Phí Tàu</h3>
                <button class="close-btn" onclick="app.closeModal('vessel-expense-modal')" style="background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveVesselExpense('${e.id || ''}');">
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Chọn Tàu</label>
                            <select class="form-control" id="ve-m-vessel" onchange="app.updateVesselExpenseModalVoyages()" required>
                                ${vessels.map(v => `<option value="${v.id}" ${v.id === firstVesselId ? 'selected' : ''}>${v.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ngày Chi</label>
                            <input type="date" class="form-control" id="ve-m-date" value="${e.date || new Date().toISOString().substring(0, 10)}" required>
                        </div>
                    </div>

                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Phân nhóm Chi Phí</label>
                            <select class="form-control" id="ve-m-category" required>
                                ${categories.map(c => `<option value="${c}" ${e.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Liên kết Chuyến</label>
                            <select class="form-control" id="ve-m-voyage">
                                <option value="">--- Không liên kết ---</option>
                                ${shipments.map(s => `<option value="${s.voyageNo}" ${e.voyageNo === s.voyageNo ? 'selected' : ''}>Chuyến ${s.voyageNo} (${s.cargo})</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Số Tiền (VND)</label>
                        <input type="number" step="any" class="form-control" id="ve-m-amount" value="${e.amount || ''}" required placeholder="Nhập số tiền chi...">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Nội Dung Chi Tiết</label>
                        <textarea class="form-control" id="ve-m-content" rows="3" required placeholder="Nhập mô tả chi tiết nội dung chi tiêu...">${e.content || ''}</textarea>
                    </div>

                    <div class="modal-footer" style="padding-top:1rem; display:flex; gap:1rem;">
                        <button type="button" class="btn btn-outline" onclick="app.closeModal('vessel-expense-modal')" style="flex:1;">Hủy</button>
                        <button type="submit" class="btn btn-primary" style="flex:2;">Lưu Khoản Chi</button>
                    </div>
                </form>
            </div>
        `;
    },

    reports: (currentTab = 'voyage', filterMonth = '', filterVessel = '', filterVesselMonthly = '', filterMonthMonthly = '', filterYearSummary = '', filterPeriodPersonal = '', filterMonthFrom = '', filterMonthTo = '') => {
        let content = '';

        if (currentTab === 'monthly') {
            // === BÁO CÁO THÁNG (DOANH THU - CHI PHÍ TÀU) ===
            const vessels = AppData.getVessels();
            const firstVesselId = vessels[0] ? vessels[0].id : '';

            // Build available months from shipments (completed only)
            const ships = AppData.getShipments().filter(s => s.contractNo && s.contractNo.trim() !== '');
            const monthsSet = new Set();
            ships.forEach(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (m) monthsSet.add(m);
            });
            const availableMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

            // Defaults
            if (!filterVesselMonthly && firstVesselId) filterVesselMonthly = firstVesselId;
            if (!filterMonthMonthly && availableMonths.length > 0) filterMonthMonthly = availableMonths[0];

            const fvm = filterVesselMonthly;
            const fmm = filterMonthMonthly;

            let reportHTML = '';

            if (fvm && fmm) {
                const vessel = AppData.getVessel(fvm);
                const vesselName = vessel ? vessel.name : fvm;
                const [year, month] = fmm.split('-').map(Number);

                // Shipments for vessel/month
                const shipments = ships.filter(s => {
                    const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                    return s.vesselId === fvm && m === fmm;
                }).sort((a, b) => (a.voyageNo || '').localeCompare(b.voyageNo || ''));

                // Transactions
                const txs = (AppData.state.transactions || []).filter(t => t.vessel === fvm && t.date && t.date.substring(0, 7) === fmm);

                // DO cost calculated from fuel supply orders (fuelVoyages) in the month
                const doCost = AppData.state.fuelVoyages.filter(v => v.vesselId === fvm && AppData.parseYearMonth(v.fuelDate) === fmm)
                    .reduce((sum, v) => sum + Math.round((Number(v.addedFuel) || 0) * (Number(v.fuelUnitPrice) || 0)), 0);

                // LO cost
                const loCost = (AppData.state.loSupplies || []).filter(s => s.vesselId === fvm && s.date && s.date.substring(0, 7) === fmm)
                    .reduce((sum, s) => sum + Math.round((Number(s.qty) || 0) * (Number(s.price) || 0)), 0);

                // Tàu ứng chi phí
                const vesselAdvanceTxs = txs.filter(t => t.category && (
                    t.category === '1.Tàu Ứng' ||
                    t.category === '1.Tàu ứng' ||
                    t.category.trim().toLowerCase().includes('tàu ứng')
                ));
                const vesselAdvances = vesselAdvanceTxs.reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

                // Lương
                const monthlyCost = AppData.getMonthlyCosts(fmm, fvm);
                const crewSalary = monthlyCost.salary || 0;

                // Lãi vay
                const interestTxs = txs.filter(t => t.category === '6.Lãi Vay' || t.category === '6.Lại Vay');
                const totalInterest = interestTxs.reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

                // Chi phí cảng
                const agentTxs = txs.filter(t => t.category === '2.Chi Phí Cảng');
                const totalAgent = agentTxs.reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

                // Vật tư
                const materialTxs = txs.filter(t => t.category === '9.Vật Tư');
                const totalMaterial = materialTxs.reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

                // Inputs lưu trữ (dư đầu tháng, chi phí văn phòng, VAT tùy chỉnh)
                const inputs = app.getMonthlyVesselReportInputs(fvm, fmm);
                const openingBalance = Number(inputs.openingBalance) || 0;
                let customTotal = 0;
                inputs.customExpenses.forEach(exp => { customTotal += Number(exp.amount) || 0; });
                const overrides = inputs.overrides || {};

                // Bảo hiểm
                const daysInMonth = new Date(year, month, 0).getDate();
                const annualConfig = AppData.getAnnualCosts(year, fvm);
                const hullInsurance = Math.round(daysInMonth * (annualConfig.hullInsuranceDaily || 0));
                const socialInsurance = monthlyCost.insurance || 0;
                const hullInsuranceVal = overrides.hullInsurance !== undefined ? Number(overrides.hullInsurance) : hullInsurance;
                const socialInsuranceVal = overrides.socialInsurance !== undefined ? Number(overrides.socialInsurance) : socialInsurance;
                let totalInsurance = hullInsuranceVal + socialInsuranceVal;
                if (overrides.hullInsurance === undefined && overrides.socialInsurance === undefined && overrides.insurance !== undefined) {
                    totalInsurance = Number(overrides.insurance);
                }

                // VAT từ chuyến (tính tự động)
                const autoVat = shipments.reduce((sum, s) => sum + (Number(s.costs?.vat) || 0), 0);
                const vatVal = overrides.vat !== undefined ? Number(overrides.vat) : autoVat;

                const doCostVal = overrides.doCost !== undefined ? Number(overrides.doCost) : doCost;
                const loCostVal = overrides.loCost !== undefined ? Number(overrides.loCost) : loCost;
                const advancesVal = overrides.advances !== undefined ? Number(overrides.advances) : vesselAdvances;
                const salaryVal = overrides.salary !== undefined ? Number(overrides.salary) : crewSalary;
                const interestVal = overrides.interest !== undefined ? Number(overrides.interest) : totalInterest;
                const agentVal = overrides.agent !== undefined ? Number(overrides.agent) : totalAgent;
                const materialVal = overrides.material !== undefined ? Number(overrides.material) : totalMaterial;

                // Doanh thu
                const totalRevenueSum = shipments.reduce((sum, s) => {
                    let sTotal = Number(s.revenueReal || 0);
                    if (s.revenueInvoice > s.revenueReal) {
                        const rate = s.commissionRate !== undefined ? s.commissionRate / 100 : ((s.contractNo === 'HD25' || s.contractNo === 'HD54') ? 0.20 : 0.28);
                        sTotal += Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * rate);
                    }
                    return sum + sTotal;
                }, 0);

                const totalCostSum = doCostVal + loCostVal + advancesVal + salaryVal + interestVal + agentVal + materialVal + totalInsurance + vatVal + customTotal;
                const finalBalance = openingBalance + totalRevenueSum - totalCostSum;

                reportHTML = `
                    <div id="monthly-report-inline" class="glass-card" style="padding: 0; overflow: hidden;">
                        <!-- Action bar -->
                        <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); background: rgba(255,255,255,0.03);">
                            <strong style="color: var(--primary-light); font-size: 1rem;"><i class="fa-solid fa-file-invoice-dollar"></i> Bảng theo dõi Doanh thu - Chi phí Tháng ${month}/${year} - Tàu ${vesselName}</strong>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-outline" style="border-color: #10b981; color: #10b981;" onclick="app.exportMonthlyVesselReport('${fvm}', '${fmm}')">
                                    <i class="fa-solid fa-file-excel"></i> Xuất Excel
                                </button>
                                <button class="btn btn-primary" onclick="window.print()">
                                    <i class="fa-solid fa-print"></i> In báo cáo
                                </button>
                            </div>
                        </div>

                        <!-- Print header -->
                        <div class="print-header" style="padding: 1.5rem 1.5rem 0.5rem; text-align: center;">
                            <h2 style="font-size: 1.1rem; font-weight: 900; text-transform: uppercase; margin: 0;">BẢNG THEO DÕI DOANH THU - CHI PHÍ TÀU ${vesselName.toUpperCase()}</h2>
                            <h3 style="font-size: 1rem; font-weight: 700; margin: 4px 0 0;">THÁNG ${month}/${year}</h3>
                        </div>

                        <div style="padding: 1rem 1.5rem 1.5rem; overflow-x: auto;"
                             data-do-cost="${doCost}"
                             data-lo-cost="${loCost}"
                             data-advances="${vesselAdvances}"
                             data-salary="${crewSalary}"
                             data-interest="${totalInterest}"
                             data-agent="${totalAgent}"
                             data-material="${totalMaterial}"
                             data-insurance="${hullInsurance + socialInsurance}"
                             data-vat="${autoVat}"
                             data-revenue="${totalRevenueSum}"
                             id="monthly-report-data">
                            <table class="report-print-table" style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                                <thead>
                                    <tr style="background: #2d3a4a; color: #e2e8f0; font-weight: bold;">
                                        <th style="width: 50px; text-align: center; padding: 8px 4px; border: 1px solid #4a5568;">STT</th>
                                        <th style="padding: 8px; border: 1px solid #4a5568;">CHI TIẾT HẠNG MỤC</th>
                                        <th style="text-align: right; width: 130px; padding: 8px; border: 1px solid #4a5568;">DƯ ĐẦU THÁNG</th>
                                        <th style="text-align: right; width: 130px; padding: 8px; border: 1px solid #4a5568;">DOANH THU</th>
                                        <th style="text-align: right; width: 130px; padding: 8px; border: 1px solid #4a5568;">CHI PHÍ</th>
                                        <th style="text-align: right; width: 130px; padding: 8px; border: 1px solid #4a5568;">TỒN CUỐI THÁNG</th>
                                        <th style="width: 100px; text-align: center; padding: 8px; border: 1px solid #4a5568;">GHI CHÚ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- Dư đầu tháng -->
                                    <tr style="background: rgba(148,163,184,0.15); font-weight: bold;">
                                        <td style="text-align: center; padding: 7px 4px; border: 1px solid #4a5568;">
                                            ${inputs.isManualOpening ? `
                                                <button class="no-print" title="Khôi phục tồn đầu tự động" onclick="app.resetMIOpeningField()" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-calculator" style="color: #10b981; opacity: 0.8;" title="Tính tự động"></i>
                                            `}
                                        </td>
                                        <td style="padding: 7px 8px; border: 1px solid #4a5568;">Tồn tháng trước chuyển sang</td>
                                        <td style="text-align: right; padding: 7px 8px; border: 1px solid #4a5568;">
                                            <input type="number" id="mi-rep-opening" class="print-input print-input-amount"
                                                value="${openingBalance}"
                                                oninput="app.recalcInlineMonthlyReport()"
                                                style="font-weight:bold; text-align:right; width:100%; color:inherit; font-size:inherit; box-sizing:border-box;">
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>

                                    <!-- DOANH THU CHUYẾN -->
                                    ${shipments.map((s, idx) => {
                                        const qtyStr = Math.round(Number(s.qty || 0)).toLocaleString('en-US');
                                        const rateStr = Math.round(Number(s.rate || 0)).toLocaleString('en-US');
                                        const details = `HĐ ${s.contractNo || ''} ${vesselName} ${s.portLoad || ''} - ${s.portDischarge || ''} (${s.customer || ''}) ${qtyStr} * ${rateStr}`;
                                        let vatRow = '';
                                        if (s.revenueInvoice > s.revenueReal) {
                                            const rate = s.commissionRate !== undefined ? s.commissionRate / 100 : ((s.contractNo === 'HD25' || s.contractNo === 'HD54') ? 0.20 : 0.28);
                                            const vatAmt = Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * rate);
                                            vatRow = `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                                <td style="text-align: center; padding: 6px 4px; border: 1px solid #4a5568;"></td>
                                                <td style="padding: 6px 8px 6px 24px; border: 1px solid #4a5568; color: #94a3b8;">VAT tính thêm chuyến này</td>
                                                <td style="border: 1px solid #4a5568;"></td>
                                                <td style="text-align: right; padding: 6px 8px; border: 1px solid #4a5568; color: #10b981; font-weight: 500;">${AppData.formatCurrency(vatAmt)}</td>
                                                <td style="border: 1px solid #4a5568;"></td>
                                                <td style="border: 1px solid #4a5568;"></td>
                                                <td style="border: 1px solid #4a5568;"></td>
                                            </tr>`;
                                        }
                                        return `
                                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                                <td style="text-align: center; padding: 6px 4px; border: 1px solid #4a5568; font-weight: bold;">${s.voyageNo || (idx+1)}</td>
                                                <td style="padding: 6px 8px; border: 1px solid #4a5568; font-weight: 500;">${details}</td>
                                                <td style="border: 1px solid #4a5568;"></td>
                                                <td style="text-align: right; padding: 6px 8px; border: 1px solid #4a5568; color: #10b981; font-weight: bold;">${AppData.formatCurrency(s.revenueReal)}</td>
                                                <td style="border: 1px solid #4a5568;"></td>
                                                <td style="border: 1px solid #4a5568;"></td>
                                                <td style="border: 1px solid #4a5568;"></td>
                                            </tr>${vatRow}`;
                                    }).join('')}

                                    <!-- DẦU DO -->
                                    <tr style="background: rgba(148,163,184,0.1); font-weight: bold; border-top: 1px solid #4a5568;">
                                        <td style="text-align: center; padding: 7px 4px; border: 1px solid #4a5568;">
                                            ${overrides.doCost !== undefined ? `
                                                <button class="no-print" title="Khôi phục tính tự động" onclick="app.resetMICostField('doCost', ${doCost})" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-calculator" style="color: #10b981; opacity: 0.8;" title="Tính tự động"></i>
                                            `}
                                        </td>
                                        <td style="padding: 7px 8px; border: 1px solid #4a5568;">Dầu DO</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="text-align: right; padding: 7px 8px; border: 1px solid #4a5568; font-weight: bold;">
                                            <input type="number" class="print-input mi-cost-input" id="mi-cost-doCost"
                                                data-field="doCost" data-auto="${doCost}"
                                                value="${doCostVal}"
                                                oninput="app.recalcInlineMonthlyReport()"
                                                style="font-weight:bold; text-align:right; width:100%; color:${overrides.doCost !== undefined ? '#fbbf24' : 'inherit'}; font-size:inherit; box-sizing:border-box;">
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>

                                    <!-- DẦU LO -->
                                    <tr style="background: rgba(148,163,184,0.1); font-weight: bold;">
                                        <td style="text-align: center; padding: 7px 4px; border: 1px solid #4a5568;">
                                            ${overrides.loCost !== undefined ? `
                                                <button class="no-print" title="Khôi phục tính tự động" onclick="app.resetMICostField('loCost', ${loCost})" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-calculator" style="color: #10b981; opacity: 0.8;" title="Tính tự động"></i>
                                            `}
                                        </td>
                                        <td style="padding: 7px 8px; border: 1px solid #4a5568;">Dầu LO</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="text-align: right; padding: 7px 8px; border: 1px solid #4a5568; font-weight: bold;">
                                            <input type="number" class="print-input mi-cost-input" id="mi-cost-loCost"
                                                data-field="loCost" data-auto="${loCost}"
                                                value="${loCostVal}"
                                                oninput="app.recalcInlineMonthlyReport()"
                                                style="font-weight:bold; text-align:right; width:100%; color:${overrides.loCost !== undefined ? '#fbbf24' : 'inherit'}; font-size:inherit; box-sizing:border-box;">
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>

                                    <!-- TÀU CHI -->
                                    <tr style="background: rgba(148,163,184,0.1); font-weight: bold;">
                                        <td style="text-align: center; padding: 7px 4px; border: 1px solid #4a5568;">
                                            ${overrides.advances !== undefined ? `
                                                <button class="no-print" title="Khôi phục tính tự động" onclick="app.resetMICostField('advances', ${vesselAdvances})" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-calculator" style="color: #10b981; opacity: 0.8;" title="Tính tự động"></i>
                                            `}
                                        </td>
                                        <td style="padding: 7px 8px; border: 1px solid #4a5568;">Tàu chi (Tiền ứng trong tháng)</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="text-align: right; padding: 7px 8px; border: 1px solid #4a5568; font-weight: bold;">
                                            <input type="number" class="print-input mi-cost-input" id="mi-cost-advances"
                                                data-field="advances" data-auto="${vesselAdvances}"
                                                value="${advancesVal}"
                                                oninput="app.recalcInlineMonthlyReport()"
                                                style="font-weight:bold; text-align:right; width:100%; color:${overrides.advances !== undefined ? '#fbbf24' : 'inherit'}; font-size:inherit; box-sizing:border-box;">
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>

                                    <!-- LƯƠNG -->
                                    <tr style="background: rgba(148,163,184,0.1); font-weight: bold;">
                                        <td style="text-align: center; padding: 7px 4px; border: 1px solid #4a5568;">
                                            ${overrides.salary !== undefined ? `
                                                <button class="no-print" title="Khôi phục tính tự động" onclick="app.resetMICostField('salary', ${crewSalary})" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-calculator" style="color: #10b981; opacity: 0.8;" title="Tính tự động"></i>
                                            `}
                                        </td>
                                        <td style="padding: 7px 8px; border: 1px solid #4a5568;">Lương</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="text-align: right; padding: 7px 8px; border: 1px solid #4a5568; font-weight: bold;">
                                            <input type="number" class="print-input mi-cost-input" id="mi-cost-salary"
                                                data-field="salary" data-auto="${crewSalary}"
                                                value="${salaryVal}"
                                                oninput="app.recalcInlineMonthlyReport()"
                                                style="font-weight:bold; text-align:right; width:100%; color:${overrides.salary !== undefined ? '#fbbf24' : 'inherit'}; font-size:inherit; box-sizing:border-box;">
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>

                                    <!-- LÃI VAY -->
                                    <tr style="background: rgba(148,163,184,0.1); font-weight: bold;">
                                        <td style="text-align: center; padding: 7px 4px; border: 1px solid #4a5568;">
                                            ${overrides.interest !== undefined ? `
                                                <button class="no-print" title="Khôi phục tính tự động" onclick="app.resetMICostField('interest', ${totalInterest})" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-calculator" style="color: #10b981; opacity: 0.8;" title="Tính tự động"></i>
                                            `}
                                        </td>
                                        <td style="padding: 7px 8px; border: 1px solid #4a5568;">Lãi vay (Trong và ngoài ngân hàng)</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="text-align: right; padding: 7px 8px; border: 1px solid #4a5568; font-weight: bold;">
                                            <input type="number" class="print-input mi-cost-input" id="mi-cost-interest"
                                                data-field="interest" data-auto="${totalInterest}"
                                                value="${interestVal}"
                                                oninput="app.recalcInlineMonthlyReport()"
                                                style="font-weight:bold; text-align:right; width:100%; color:${overrides.interest !== undefined ? '#fbbf24' : 'inherit'}; font-size:inherit; box-sizing:border-box;">
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>
                                    ${interestTxs.map(t => `
                                        <tr>
                                            <td style="text-align: center; padding: 5px 4px; border: 1px solid #4a5568;"></td>
                                            <td style="padding: 5px 8px 5px 24px; border: 1px solid #4a5568; color: #94a3b8;">${t.content || 'Lãi vay'}</td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="text-align: right; padding: 5px 8px; border: 1px solid #4a5568;">${AppData.formatCurrency(t.chi)}</td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                        </tr>`).join('')}

                                    <!-- CHI PHÍ CẢNG -->
                                    <tr style="background: rgba(148,163,184,0.1); font-weight: bold;">
                                        <td style="text-align: center; padding: 7px 4px; border: 1px solid #4a5568;">
                                            ${overrides.agent !== undefined ? `
                                                <button class="no-print" title="Khôi phục tính tự động" onclick="app.resetMICostField('agent', ${totalAgent})" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-calculator" style="color: #10b981; opacity: 0.8;" title="Tính tự động"></i>
                                            `}
                                        </td>
                                        <td style="padding: 7px 8px; border: 1px solid #4a5568;">Chi phí cảng</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="text-align: right; padding: 7px 8px; border: 1px solid #4a5568; font-weight: bold;">
                                            <input type="number" class="print-input mi-cost-input" id="mi-cost-agent"
                                                data-field="agent" data-auto="${totalAgent}"
                                                value="${agentVal}"
                                                oninput="app.recalcInlineMonthlyReport()"
                                                style="font-weight:bold; text-align:right; width:100%; color:${overrides.agent !== undefined ? '#fbbf24' : 'inherit'}; font-size:inherit; box-sizing:border-box;">
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>
                                    ${agentTxs.map(t => `
                                        <tr>
                                            <td style="text-align: center; padding: 5px 4px; border: 1px solid #4a5568;"></td>
                                            <td style="padding: 5px 8px 5px 24px; border: 1px solid #4a5568; color: #94a3b8;">+ ${t.content || 'Chi phí cảng'}</td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="text-align: right; padding: 5px 8px; border: 1px solid #4a5568;">${AppData.formatCurrency(t.chi)}</td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                        </tr>`).join('')}

                                    <!-- VẬT TƯ -->
                                    <tr style="background: rgba(148,163,184,0.1); font-weight: bold;">
                                        <td style="text-align: center; padding: 7px 4px; border: 1px solid #4a5568;">
                                            ${overrides.material !== undefined ? `
                                                <button class="no-print" title="Khôi phục tính tự động" onclick="app.resetMICostField('material', ${totalMaterial})" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-calculator" style="color: #10b981; opacity: 0.8;" title="Tính tự động"></i>
                                            `}
                                        </td>
                                        <td style="padding: 7px 8px; border: 1px solid #4a5568;">Vật tư</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="text-align: right; padding: 7px 8px; border: 1px solid #4a5568; font-weight: bold;">
                                            <input type="number" class="print-input mi-cost-input" id="mi-cost-material"
                                                data-field="material" data-auto="${totalMaterial}"
                                                value="${materialVal}"
                                                oninput="app.recalcInlineMonthlyReport()"
                                                style="font-weight:bold; text-align:right; width:100%; color:${overrides.material !== undefined ? '#fbbf24' : 'inherit'}; font-size:inherit; box-sizing:border-box;">
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>
                                    ${materialTxs.map(t => `
                                        <tr>
                                            <td style="text-align: center; padding: 5px 4px; border: 1px solid #4a5568;"></td>
                                            <td style="padding: 5px 8px 5px 24px; border: 1px solid #4a5568; color: #94a3b8;">${t.content || 'Vật tư'}</td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="text-align: right; padding: 5px 8px; border: 1px solid #4a5568;">${AppData.formatCurrency(t.chi)}</td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                        </tr>`).join('')}

                                    <!-- BẢO HIỂM -->
                                    <tr style="background: rgba(148,163,184,0.1); font-weight: bold;">
                                        <td style="text-align: center; padding: 7px 4px; border: 1px solid #4a5568;" id="mi-insurance-action">
                                            ${(overrides.insurance !== undefined && overrides.hullInsurance === undefined && overrides.socialInsurance === undefined) ? `
                                                <button class="no-print" title="Khôi phục tính tự động" onclick="app.resetMICostField('insurance', ${hullInsurance + socialInsurance})" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-shield-halved" style="color: #64748b; opacity: 0.8;" title="Nhóm bảo hiểm"></i>
                                            `}
                                        </td>
                                        <td style="padding: 7px 8px; border: 1px solid #4a5568;">Bảo hiểm</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="text-align: right; padding: 7px 8px; border: 1px solid #4a5568; color: #f87171; font-weight: bold;">
                                            <span id="mi-display-insurance" style="color:${(overrides.hullInsurance !== undefined || overrides.socialInsurance !== undefined || overrides.insurance !== undefined) ? '#fbbf24' : 'inherit'}">${AppData.formatCurrency(totalInsurance)}</span>
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>
                                    <tr>
                                        <td style="text-align: center; padding: 5px 4px; border: 1px solid #4a5568;">
                                            ${overrides.hullInsurance !== undefined ? `
                                                <button class="no-print" title="Khôi phục tính tự động" onclick="app.resetMICostField('hullInsurance', ${hullInsurance})" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-calculator" style="color: #10b981; opacity: 0.8;" title="Tính tự động"></i>
                                            `}
                                        </td>
                                        <td style="padding: 5px 8px 5px 24px; border: 1px solid #4a5568; color: #94a3b8;">Bảo hiểm tàu (Phân bổ tháng - ${daysInMonth} ngày)</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="text-align: right; padding: 5px 8px; border: 1px solid #4a5568; font-weight: bold;">
                                            <input type="number" class="print-input mi-cost-input" id="mi-cost-hullInsurance"
                                                data-field="hullInsurance" data-auto="${hullInsurance}"
                                                value="${hullInsuranceVal}"
                                                oninput="app.recalcInlineMonthlyReport()"
                                                style="font-weight:bold; text-align:right; width:100%; color:${overrides.hullInsurance !== undefined ? '#fbbf24' : 'inherit'}; font-size:inherit; box-sizing:border-box;">
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>
                                    <tr>
                                        <td style="text-align: center; padding: 5px 4px; border: 1px solid #4a5568;">
                                            ${overrides.socialInsurance !== undefined ? `
                                                <button class="no-print" title="Khôi phục tính tự động" onclick="app.resetMICostField('socialInsurance', ${socialInsurance})" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-calculator" style="color: #10b981; opacity: 0.8;" title="Tính tự động"></i>
                                            `}
                                        </td>
                                        <td style="padding: 5px 8px 5px 24px; border: 1px solid #4a5568; color: #94a3b8;">Bảo hiểm xã hội tháng</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="text-align: right; padding: 5px 8px; border: 1px solid #4a5568; font-weight: bold;">
                                            <input type="number" class="print-input mi-cost-input" id="mi-cost-socialInsurance"
                                                data-field="socialInsurance" data-auto="${socialInsurance}"
                                                value="${socialInsuranceVal}"
                                                oninput="app.recalcInlineMonthlyReport()"
                                                style="font-weight:bold; text-align:right; width:100%; color:${overrides.socialInsurance !== undefined ? '#fbbf24' : 'inherit'}; font-size:inherit; box-sizing:border-box;">
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>

                                    <!-- VAT -->
                                    <tr style="background: rgba(148,163,184,0.1); font-weight: bold;">
                                        <td style="text-align: center; padding: 7px 4px; border: 1px solid #4a5568;">
                                            ${overrides.vat !== undefined ? `
                                                <button class="no-print" title="Khôi phục tính tự động" onclick="app.resetMICostField('vat', ${autoVat})" style="background:none; border:none; color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i></button>
                                            ` : `
                                                <i class="fa-solid fa-calculator" style="color: #10b981; opacity: 0.8;" title="Tính tự động"></i>
                                            `}
                                        </td>
                                        <td style="padding: 7px 8px; border: 1px solid #4a5568;">VAT (các chuyến phát sinh trong tháng)</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="text-align: right; padding: 7px 8px; border: 1px solid #4a5568; font-weight: bold;">
                                            <input type="number" class="print-input mi-cost-input" id="mi-cost-vat"
                                                data-field="vat" data-auto="${autoVat}"
                                                value="${vatVal}"
                                                oninput="app.recalcInlineMonthlyReport()"
                                                style="font-weight:bold; text-align:right; width:100%; color:${overrides.vat !== undefined ? '#fbbf24' : 'inherit'}; font-size:inherit; box-sizing:border-box;">
                                        </td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>
                                </tbody>

                                <!-- Chi phí văn phòng / tự nhập -->
                                <tbody id="mi-rep-custom-body">
                                    <tr style="background: rgba(100,116,139,0.2); border-top: 2px solid #64748b;">
                                        <td colspan="7" style="font-weight: bold; padding: 7px 8px; border: 1px solid #4a5568;">Chi phí văn phòng và các chi phí khác:</td>
                                    </tr>
                                    ${inputs.customExpenses.map((exp, expIdx) => `
                                        <tr class="mi-custom-expense-row">
                                            <td style="text-align: center; padding: 6px 4px; border: 1px solid #4a5568;">
                                                <button class="btn-delete-row no-print" style="background:none;border:none;cursor:pointer;color:#f87171;" onclick="app.deleteMICustomRow(this)"><i class="fa-solid fa-trash"></i></button>
                                            </td>
                                            <td style="padding: 6px 8px 6px 24px; border: 1px solid #4a5568; color: #94a3b8;">
                                                <input type="text" class="mi-custom-desc print-input-desc" value="${exp.desc || ''}" placeholder="Nhập tên chi phí..." oninput="app.recalcInlineMonthlyReport()" style="width:100%;color:inherit;font-size:inherit;box-sizing:border-box;">
                                            </td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="text-align: right; padding: 6px 8px; border: 1px solid #4a5568; color: #f87171;">
                                                <input type="number" class="mi-custom-amount print-input" value="${exp.amount || 0}" oninput="app.recalcInlineMonthlyReport()" style="text-align:right;width:100%;color:inherit;font-size:inherit;font-weight:bold;box-sizing:border-box;">
                                            </td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                            <td style="border: 1px solid #4a5568;"></td>
                                        </tr>`).join('')}
                                </tbody>

                                <tbody>
                                    <!-- Add row button -->
                                    <tr class="no-print">
                                        <td colspan="7" style="border: 1px solid #4a5568; padding: 6px 8px; background: rgba(0,0,0,0.1);">
                                            <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.82rem;" onclick="app.addMICustomRow()">
                                                <i class="fa-solid fa-plus"></i> Thêm chi phí văn phòng / khác
                                            </button>
                                        </td>
                                    </tr>

                                    <!-- TỔNG CỘNG -->
                                    <tr style="background: #2d3a4a; font-weight: bold; font-size: 1rem; border-top: 2px solid #64748b;">
                                        <td style="text-align: center; padding: 10px 4px; border: 1px solid #4a5568;"></td>
                                        <td style="text-align: center; padding: 10px 8px; border: 1px solid #4a5568; color: #e2e8f0; font-size: 1.05rem;">Cộng</td>
                                        <td style="text-align: right; padding: 10px 8px; border: 1px solid #4a5568; color: #60a5fa;" id="mi-rep-total-opening">${AppData.formatCurrency(openingBalance)}</td>
                                        <td style="text-align: right; padding: 10px 8px; border: 1px solid #4a5568; color: #10b981;" id="mi-rep-total-revenue">${AppData.formatCurrency(totalRevenueSum)}</td>
                                        <td style="text-align: right; padding: 10px 8px; border: 1px solid #4a5568; color: #f87171;" id="mi-rep-total-cost">${AppData.formatCurrency(totalCostSum)}</td>
                                        <td style="text-align: right; padding: 10px 8px; border: 1px solid #4a5568; color: #34d399; font-size: 1.1rem;" id="mi-rep-total-balance">${AppData.formatCurrency(finalBalance)}</td>
                                        <td style="border: 1px solid #4a5568;"></td>
                                    </tr>
                                </tbody>
                            </table>

                            <div style="margin-top: 2rem; text-align: right; font-style: italic; font-size: 0.85rem; color: #94a3b8;">
                                Lập ngày ${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                reportHTML = `<p style="text-align:center; color:var(--text-muted); padding: 2rem;">Vui lòng chọn tàu và tháng để xem báo cáo.</p>`;
            }

            content = `
                <div class="glass-card" style="margin-bottom: 1.5rem; padding: 1rem 1.5rem;">
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 1rem;">
                        <div class="form-group" style="margin: 0; width: 180px;">
                            <label class="form-label" style="margin-bottom: 0.25rem;">Chọn Tàu</label>
                            <select class="form-control" style="width: 100%;" onchange="app.navigate('reports', 'monthly', '', '', this.value, '${fmm}')">
                                ${vessels.map(v => `<option value="${v.id}" ${v.id === fvm ? 'selected' : ''}>${v.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin: 0; width: 180px;">
                            <label class="form-label" style="margin-bottom: 0.25rem;">Tháng hạch toán</label>
                            <select class="form-control" style="width: 100%;" onchange="app.navigate('reports', 'monthly', '', '', '${fvm}', this.value)">
                                <option value="">-- Chọn tháng --</option>
                                ${availableMonths.map(m => `<option value="${m}" ${m === fmm ? 'selected' : ''}>Tháng ${m.split('-')[1]}/${m.split('-')[0]}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                ${reportHTML}
            `;
        } else if (currentTab === 'fuel') {
            const supplierDebts = AppData.getSupplierDebts();
            
            // Extract all purchases with their allocated payments
            let allPurchases = [];
            supplierDebts.forEach(supplier => {
                supplier.purchases.forEach(p => {
                    allPurchases.push({
                        ...p,
                        supplierName: supplier.name
                    });
                });
            });
            
            // Sort by date ascending
            allPurchases.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Build filter months dropdown
            const monthsSet = new Set();
            allPurchases.forEach(p => {
                if (p.date) {
                    const d = new Date(p.date);
                    if (!isNaN(d.getTime())) {
                        const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                        p.filterMonth = m;
                        monthsSet.add(m);
                    }
                }
            });
            const availableMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
            if (!filterMonth && availableMonths.length > 0) {
                filterMonth = availableMonths[0]; // Mặc định chọn tháng mới nhất
            }
            
            // Filter by month
            const monthPurchases = allPurchases.filter(p => p.filterMonth === filterMonth);
            
            // Group by Vessel
            const groupedByVessel = {};
            monthPurchases.forEach(p => {
                if (!groupedByVessel[p.vessel]) groupedByVessel[p.vessel] = [];
                groupedByVessel[p.vessel].push(p);
            });
            
            // Build HTML
            let fuelHTML = '';
            
            if (monthPurchases.length === 0) {
                fuelHTML = `<p style="text-align:center; color:var(--text-muted); padding: 2rem;">Không có dữ liệu cấp dầu trong tháng này.</p>`;
            } else {
                fuelHTML += `<div class="table-responsive"><table class="table" style="font-size: 0.85rem;">
                    <thead>
                        <tr>
                            <th>TÀU</th>
                            <th>NGÀY CẤP</th>
                            <th>ĐỊA ĐIỂM</th>
                            <th style="text-align:right;">SỐ LƯỢNG</th>
                            <th style="text-align:right;">ĐƠN GIÁ</th>
                            <th style="text-align:right;">THÀNH TIỀN</th>
                            <th style="text-align:right;">THANH TOÁN</th>
                            <th style="text-align:right;">CÒN NỢ</th>
                            <th>ĐV CẤP</th>
                        </tr>
                    </thead>
                    <tbody>`;
                
                Object.keys(groupedByVessel).sort().forEach(vesselId => {
                    const group = groupedByVessel[vesselId];
                    let groupQty = 0, groupCost = 0, groupPaid = 0, groupRemaining = 0;
                    
                    group.forEach((p, idx) => {
                        const fuelVoy = AppData.state.fuelVoyages.find(v => v.id === p.id);
                        const location = fuelVoy ? fuelVoy.fuelLocation : '---';
                        
                        groupQty += Number(p.qty) || 0;
                        groupCost += p.cost;
                        groupPaid += p.paid;
                        groupRemaining += p.remaining;
                        
                        fuelHTML += `<tr>
                            <td>${idx === 0 ? `<strong>${vesselId}</strong>` : ''}</td>
                            <td>${p.date ? new Date(p.date).toLocaleDateString('vi-VN') : '---'}</td>
                            <td>${location}</td>
                            <td style="text-align:right; font-weight:bold;">${Math.round(Number(p.qty || 0)).toLocaleString('vi-VN')}</td>
                            <td style="text-align:right;">${AppData.formatCurrency(p.price)}</td>
                            <td style="text-align:right; color:var(--info);">${AppData.formatCurrency(p.cost)}</td>
                            <td style="text-align:right; color:var(--secondary);">${p.paid > 0 ? AppData.formatCurrency(p.paid) : '-'}</td>
                            <td style="text-align:right; color:var(--accent); font-weight:bold;">${p.remaining > 0 ? AppData.formatCurrency(p.remaining) : '-'}</td>
                            <td>${p.supplierName}</td>
                        </tr>`;
                    });
                    
                    // Group Total
                    fuelHTML += `<tr style="background: rgba(245, 158, 11, 0.1); font-weight:bold;">
                        <td colspan="3" style="color: #f59e0b;">Cộng ${vesselId}</td>
                        <td style="text-align:right;">${Math.round(groupQty).toLocaleString('vi-VN')}</td>
                        <td></td>
                        <td style="text-align:right; color:var(--info);">${AppData.formatCurrency(groupCost)}</td>
                        <td style="text-align:right; color:var(--secondary);">${groupPaid > 0 ? AppData.formatCurrency(groupPaid) : '-'}</td>
                        <td style="text-align:right; color:var(--accent);">${groupRemaining > 0 ? AppData.formatCurrency(groupRemaining) : '-'}</td>
                        <td></td>
                    </tr>`;
                });
                
                fuelHTML += `</tbody></table></div>`;
            }
            
            content = `
                <div class="glass-card" style="margin-bottom: 1.5rem; padding: 1rem 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <label style="font-weight: bold; color: var(--text-main);">Lọc theo tháng:</label>
                            <select class="form-control" style="width: 200px;" onchange="app.navigate('reports', 'fuel', this.value)">
                                <option value="">-- Chọn tháng --</option>
                                ${availableMonths.map(m => `<option value="${m}" ${m === filterMonth ? 'selected' : ''}>Tháng ${m.split('-')[1]}/${m.split('-')[0]}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn btn-outline" onclick="app.exportFuelReport()"><i class="fa-solid fa-file-excel"></i> Xuất Excel Báo Cáo Dầu</button>
                    </div>
                </div>

                <div class="glass-card">
                    <h3 style="color: var(--accent); margin-bottom: 1rem;"><i class="fa-solid fa-gas-pump"></i> Bảng Theo Dõi Cấp DO - ${filterMonth ? 'Tháng ' + filterMonth.split('-')[1] + '/' + filterMonth.split('-')[0] : 'Tất cả'}</h3>
                    ${fuelHTML}
                </div>
            `;
        } else if (currentTab === 'personal') {
            const trans = AppData.getTransactions() || [];
            const personalTrans = trans.filter(t => t.account === 'Tài khoản cá nhân');
            
            // Collect all available months
            const monthsSet = new Set();
            personalTrans.forEach(t => {
                if (t.date) monthsSet.add(t.date.substring(0, 7));
            });
            const availableMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
            
            if (!filterPeriodPersonal) {
                if (availableMonths.length > 0) {
                    filterPeriodPersonal = availableMonths[0];
                } else {
                    filterPeriodPersonal = new Date().toISOString().substring(0, 7);
                }
            }
            
            const selectedPeriod = filterPeriodPersonal;
            
            // Sort chronologically by date
            personalTrans.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            
            const initialOpening = (AppData.state.company.openingBalances && AppData.state.company.openingBalances['Tài khoản cá nhân']) || 0;
            
            let periodOpening = initialOpening;
            let periodTrans = [];
            
            if (selectedPeriod !== 'all') {
                const preTrans = personalTrans.filter(t => t.date && t.date.substring(0, 7) < selectedPeriod);
                const preThu = preTrans.reduce((sum, t) => sum + (Number(t.thu) || 0), 0);
                const preChi = preTrans.reduce((sum, t) => sum + (Number(t.chi) || 0), 0);
                periodOpening = initialOpening + preThu - preChi;
                
                periodTrans = personalTrans.filter(t => t.date && t.date.substring(0, 7) === selectedPeriod);
            } else {
                periodTrans = personalTrans;
            }
            
            let runningBalance = periodOpening;
            let totalThu = 0;
            let totalChi = 0;
            
            let tableRowsHTML = '';
            
            // Add Dư đầu kỳ row
            tableRowsHTML += `
                <tr style="background: rgba(148,163,184,0.08); font-weight: bold;">
                    <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">-</td>
                    <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">-</td>
                    <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">-</td>
                    <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">-</td>
                    <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">-</td>
                    <td style="border: 1px solid #4a5568; padding: 7px 8px; font-weight: bold; color: var(--text-muted);">Dư đầu kỳ chuyển sang</td>
                    <td style="text-align: right; border: 1px solid #4a5568; padding: 7px 8px; color: var(--secondary);">-</td>
                    <td style="text-align: right; border: 1px solid #4a5568; padding: 7px 8px; color: var(--accent);">-</td>
                    <td style="text-align: right; border: 1px solid #4a5568; padding: 7px 8px; font-weight: bold; color: var(--info);">${AppData.formatCurrency(periodOpening)}</td>
                </tr>
            `;
            
            periodTrans.forEach((t, idx) => {
                const thuAmt = Number(t.thu) || 0;
                const chiAmt = Number(t.chi) || 0;
                runningBalance = runningBalance + thuAmt - chiAmt;
                totalThu += thuAmt;
                totalChi += chiAmt;
                
                tableRowsHTML += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">${idx + 1}</td>
                        <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">${t.date ? t.date.split('-').reverse().join('/') : ''}</td>
                        <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px; font-weight: 500;">${t.vessel || '-'}</td>
                        <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">${t.category || '-'}</td>
                        <td style="border: 1px solid #4a5568; padding: 7px 8px;">${t.partner || '-'}</td>
                        <td style="border: 1px solid #4a5568; padding: 7px 8px;">${t.content || '-'}</td>
                        <td style="text-align: right; border: 1px solid #4a5568; padding: 7px 8px; color: var(--secondary); font-weight: 500;">${thuAmt > 0 ? AppData.formatCurrency(thuAmt) : '-'}</td>
                        <td style="text-align: right; border: 1px solid #4a5568; padding: 7px 8px; color: var(--accent); font-weight: 500;">${chiAmt > 0 ? AppData.formatCurrency(chiAmt) : '-'}</td>
                        <td style="text-align: right; border: 1px solid #4a5568; padding: 7px 8px; font-weight: 500; color: var(--info);">${AppData.formatCurrency(runningBalance)}</td>
                    </tr>
                `;
            });
            
            // Add Total row
            tableRowsHTML += `
                <tr class="summary-row" style="background: rgba(79, 70, 229, 0.1); font-weight: bold; border-top: 2px solid #4a5568;">
                    <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">-</td>
                    <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">-</td>
                    <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">-</td>
                    <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">-</td>
                    <td style="text-align: center; border: 1px solid #4a5568; padding: 7px 4px;">-</td>
                    <td style="border: 1px solid #4a5568; padding: 7px 8px;">TỔNG CỘNG PHÁT SINH</td>
                    <td style="text-align: right; border: 1px solid #4a5568; padding: 7px 8px; color: var(--secondary);">${AppData.formatCurrency(totalThu)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568; padding: 7px 8px; color: var(--accent);">${AppData.formatCurrency(totalChi)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568; padding: 7px 8px; color: var(--info); font-size: 1.05rem;">${AppData.formatCurrency(runningBalance)}</td>
                </tr>
            `;
            
            content = `
                <div class="glass-card" style="margin-bottom: 1.5rem; padding: 1.25rem 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 1.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <label style="font-weight: bold; color: var(--text-main); white-space: nowrap;">Kỳ báo cáo:</label>
                                <select class="form-control" style="width: 160px;" onchange="app.navigate('reports', 'personal', '', '', '', '', '', this.value)">
                                    <option value="all" ${selectedPeriod === 'all' ? 'selected' : ''}>-- Tất cả thời gian --</option>
                                    ${availableMonths.map(m => `<option value="${m}" ${m === selectedPeriod ? 'selected' : ''}>Tháng ${m.split('-')[1]}/${m.split('-')[0]}</option>`).join('')}
                                </select>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.75rem; width: 320px;">
                                <i class="fa-solid fa-magnifying-glass" style="color: var(--text-muted);"></i>
                                <input type="text" class="form-control" placeholder="Tìm kiếm theo nội dung, đối tác, tàu..." oninput="app.filterPersonalReportTable(this.value)" style="width: 100%;">
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                            <button class="btn btn-outline" style="border-color: #10b981; color: #10b981;" onclick="app.exportPersonalAccountReport('${selectedPeriod}')">
                                <i class="fa-solid fa-file-excel"></i> Xuất Excel
                            </button>
                            <button class="btn btn-primary" onclick="window.print()">
                                <i class="fa-solid fa-print"></i> In Báo Cáo
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="grid-4" style="margin-bottom: 1.5rem;">
                    <div class="glass-card stat-card" style="padding: 1rem 1.25rem;">
                        <div class="stat-header">
                            <div class="stat-icon icon-blue" style="font-size: 1rem; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-arrow-right-to-bracket"></i></div>
                            <span class="badge badge-outline">Dư đầu kỳ</span>
                        </div>
                        <div class="stat-value" style="font-size: 1.25rem; margin-top: 0.5rem;">${AppData.formatCurrency(periodOpening)}</div>
                    </div>
                    <div class="glass-card stat-card" style="padding: 1rem 1.25rem;">
                        <div class="stat-header">
                            <div class="stat-icon icon-green" style="font-size: 1rem; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-arrow-trend-up"></i></div>
                            <span class="badge badge-outline" style="color: var(--secondary); border-color: var(--secondary);">Tổng Thu</span>
                        </div>
                        <div class="stat-value" style="font-size: 1.25rem; margin-top: 0.5rem; color: var(--secondary);">${AppData.formatCurrency(totalThu)}</div>
                    </div>
                    <div class="glass-card stat-card" style="padding: 1rem 1.25rem;">
                        <div class="stat-header">
                            <div class="stat-icon icon-red" style="font-size: 1rem; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-arrow-trend-down"></i></div>
                            <span class="badge badge-outline" style="color: var(--accent); border-color: var(--accent);">Tổng Chi</span>
                        </div>
                        <div class="stat-value" style="font-size: 1.25rem; margin-top: 0.5rem; color: var(--accent);">${AppData.formatCurrency(totalChi)}</div>
                    </div>
                    <div class="glass-card stat-card" style="padding: 1rem 1.25rem;">
                        <div class="stat-header">
                            <div class="stat-icon icon-purple" style="font-size: 1rem; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-wallet"></i></div>
                            <span class="badge badge-outline" style="color: var(--info); border-color: var(--info);">Dư cuối kỳ</span>
                        </div>
                        <div class="stat-value" style="font-size: 1.25rem; margin-top: 0.5rem; color: var(--info);">${AppData.formatCurrency(runningBalance)}</div>
                    </div>
                </div>
                
                <div class="glass-card" id="personal-report-inline" style="padding: 1.5rem; overflow-x: auto;">
                    <style>
                    @media print {
                        #personal-report-inline {
                            display: block !important;
                            background: #ffffff !important;
                            color: #000000 !important;
                            box-shadow: none !important;
                            border: none !important;
                            border-radius: 0 !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }
                        #personal-report-inline table {
                            border-collapse: collapse !important;
                            width: 100% !important;
                            border: 2px solid #000000 !important;
                        }
                        #personal-report-inline th,
                        #personal-report-inline td {
                            border: 1px solid #000000 !important;
                            padding: 6px 8px !important;
                            font-size: 0.8rem !important;
                            color: #000000 !important;
                            background: transparent !important;
                        }
                        #personal-report-inline thead tr {
                            background-color: #cbd5e1 !important;
                            font-weight: bold !important;
                        }
                        #personal-report-inline tr.summary-row {
                            background-color: #cbd5e1 !important;
                            font-weight: bold !important;
                        }
                        .grid-4 {
                            display: none !important;
                        }
                    }
                    </style>
                    <div style="text-align: center; margin-bottom: 1.5rem; color: var(--text-main);">
                        <h2 style="font-weight: 700; text-transform: uppercase; margin: 0 0 0.25rem 0; font-size: 1.35rem;">Sổ Chi Tiết Quỹ Tàu - Tài Khoản Cá Nhân</h2>
                        <h3 style="font-weight: 600; text-transform: uppercase; font-size: 1rem; color: var(--text-muted); margin: 0 0 0.5rem 0; letter-spacing: 0.5px;">
                            ${selectedPeriod === 'all' ? 'TẤT CẢ THỜI GIAN' : `THÁNG ${selectedPeriod.split('-')[1]}/${selectedPeriod.split('-')[0]}`}
                        </h3>
                        <div style="text-align: right; font-style: italic; font-size: 0.88rem; color: var(--text-muted); padding-right: 5px;">ĐVT: VNĐ</div>
                    </div>
                    
                    <table class="report-print-table" style="width: 100%; border-collapse: collapse; font-size: 0.88rem; border: 1px solid #4a5568;">
                        <thead>
                            <tr style="background: #2d3a4a; color: #e2e8f0; font-weight: bold;">
                                <th style="width: 50px; text-align: center; border: 1px solid #4a5568; padding: 8px 4px;">STT</th>
                                <th style="width: 100px; text-align: center; border: 1px solid #4a5568; padding: 8px 4px;">NGÀY</th>
                                <th style="width: 80px; text-align: center; border: 1px solid #4a5568; padding: 8px 4px;">TÀU</th>
                                <th style="width: 110px; text-align: center; border: 1px solid #4a5568; padding: 8px 4px;">HẠNG MỤC</th>
                                <th style="width: 160px; text-align: left; border: 1px solid #4a5568; padding: 8px;">ĐỐI TÁC</th>
                                <th style="text-align: left; border: 1px solid #4a5568; padding: 8px;">NỘI DUNG CHI TIẾT</th>
                                <th style="width: 130px; text-align: right; border: 1px solid #4a5568; padding: 8px;">THU (VND)</th>
                                <th style="width: 130px; text-align: right; border: 1px solid #4a5568; padding: 8px;">CHI (VND)</th>
                                <th style="width: 140px; text-align: right; border: 1px solid #4a5568; padding: 8px;">SỐ DƯ (VND)</th>
                            </tr>
                        </thead>
                        <tbody id="personal-report-tbody">
                            ${tableRowsHTML}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (currentTab === 'summary') {
            const vessels = AppData.getVessels();
            const ships = AppData.getShipments().filter(s => s.contractNo && s.contractNo.trim() !== '');
            
            // Build available years
            const yearsSet = new Set();
            ships.forEach(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (m && m.includes('-')) {
                    yearsSet.add(m.split('-')[0]);
                }
            });
            if (yearsSet.size === 0) yearsSet.add(new Date().getFullYear().toString());
            const availableYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
            
            if (!filterYearSummary && availableYears.length > 0) {
                filterYearSummary = availableYears[0];
            }
            const selectedYear = filterYearSummary;
            const selectedMonthFrom = filterMonthFrom ? parseInt(filterMonthFrom) : 1;
            const selectedMonthTo   = filterMonthTo   ? parseInt(filterMonthTo)   : 12;
            
            const formatVal1000 = (val) => {
                if (val === undefined || val === null || val === '') return '-';
                const num = Math.round(Number(val) / 1000);
                if (num === 0) return '-';
                if (num < 0) {
                    return `(${Math.abs(num).toLocaleString('vi-VN')})`;
                }
                return num.toLocaleString('vi-VN');
            };
            
            let tableRowsHTML = '';
            
            // Dòng Năm X
            tableRowsHTML += `
                <tr class="print-bold-row" style="background: rgba(148,163,184,0.15); font-weight: bold;">
                    <td></td>
                    <td style="border: 1px solid #4a5568;">Năm ${selectedYear}</td>
                    <td colspan="13" style="border: 1px solid #4a5568;"></td>
                </tr>
            `;
            
            // Track grand totals
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
            
            let lastMonthWithDataStr = '';
            const activeMonths = [];
            
            for (let m = 1; m <= 12; m++) {
                if (m < selectedMonthFrom || m > selectedMonthTo) continue;
                const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
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
                    const key = `monthly_vessel_report_inputs_${v.id}_${monthStr}`;
                    if (localStorage.getItem(key)) hasData = true;
                });
                
                if (hasData) {
                    activeMonths.push({ monthNum: m, monthStr });
                    lastMonthWithDataStr = monthStr;
                }
            }
            
            activeMonths.forEach(({ monthNum, monthStr }) => {
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
                
                vessels.forEach((v, idx) => {
                    const breakdown = app.getMonthlyVesselReportBreakdown(v.id, monthStr);
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
                    
                    tableRowsHTML += `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            ${idx === 0 ? `<td rowspan="5" style="text-align: center; vertical-align: middle; font-weight: bold; background: rgba(148,163,184,0.08); border: 1px solid #4a5568;">T${monthNum}</td>` : ''}
                            <td style="font-weight: 500; border: 1px solid #4a5568; padding-left: 10px;">${v.id}</td>
                            <td style="text-align: right; border: 1px solid #4a5568; color: var(--secondary); font-weight: 500;">${formatVal1000(breakdown.revenue)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(breakdown.doCost)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(breakdown.loCost)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(breakdown.agent)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(breakdown.advances)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(breakdown.salary)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(breakdown.interest)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(breakdown.insurance)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568; color: ${breakdown.vat < 0 ? 'var(--accent)' : 'inherit'};">${formatVal1000(breakdown.vat)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(breakdown.material)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(breakdown.other)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568; font-weight: 500;">${formatVal1000(breakdown.totalCost)}</td>
                            <td style="text-align: right; border: 1px solid #4a5568; font-weight: 500; color: var(--info);">${formatVal1000(monthlyBalance)}</td>
                        </tr>
                    `;
                });
                
                // Subtotal Row
                tableRowsHTML += `
                    <tr class="print-sub-bold-row" style="background: rgba(16, 185, 129, 0.1); font-weight: bold; border-top: 2px solid #4a5568;">
                        <td></td>
                        <td style="border: 1px solid #4a5568; padding-left: 10px;">Cộng tháng ${monthNum}</td>
                        <td style="text-align: right; border: 1px solid #4a5568; color: var(--secondary);">${formatVal1000(monthSubRevenue)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(monthSubDO)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(monthSubLO)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(monthSubAgent)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(monthSubAdvances)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(monthSubSalary)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(monthSubInterest)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(monthSubInsurance)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568; color: ${monthSubVat < 0 ? 'var(--accent)' : 'inherit'};">${formatVal1000(monthSubVat)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(monthSubMaterial)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(monthSubOther)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(monthSubCost)}</td>
                        <td style="text-align: right; border: 1px solid #4a5568; color: var(--info);">${formatVal1000(monthSubClosing)}</td>
                    </tr>
                `;
                
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
            });
            
            // Year total closing balance is the sum of closing balances (revenue - cost) of all active months
            const yearClosingBalance = yearTotalRevenue - yearTotalCost;
            
            // Grand Total Row
            tableRowsHTML += `
                <tr class="print-bold-row" style="background: rgba(79, 70, 229, 0.15); font-weight: bold; border-top: 2px solid #4a5568;">
                    <td></td>
                    <td style="border: 1px solid #4a5568; padding-left: 10px;">TỔNG CỘNG NĂM</td>
                    <td style="text-align: right; border: 1px solid #4a5568; color: var(--secondary);">${formatVal1000(yearTotalRevenue)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(yearTotalDO)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(yearTotalLO)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(yearTotalAgent)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(yearTotalAdvances)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(yearTotalSalary)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(yearTotalInterest)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(yearTotalInsurance)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568; color: ${yearTotalVat < 0 ? 'var(--accent)' : 'inherit'};">${formatVal1000(yearTotalVat)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(yearTotalMaterial)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(yearTotalOther)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568;">${formatVal1000(yearTotalCost)}</td>
                    <td style="text-align: right; border: 1px solid #4a5568; color: var(--info); font-size: 1.05rem;">${formatVal1000(yearClosingBalance)}</td>
                </tr>
            `;
            
            const monthOptions = [1,2,3,4,5,6,7,8,9,10,11,12];
            content = `
                <div class="glass-card" style="margin-bottom: 1.5rem; padding: 1rem 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <label style="font-weight: 600; color: var(--text-muted); font-size:0.85rem; white-space:nowrap;">Năm:</label>
                                <select id="summary-year" class="form-control" style="width: 130px;" onchange="app.updateSummaryFilter()">
                                    ${availableYears.map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>Năm ${y}</option>`).join('')}
                                </select>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <label style="font-weight: 600; color: var(--text-muted); font-size:0.85rem; white-space:nowrap;">Từ tháng:</label>
                                <select id="summary-month-from" class="form-control" style="width: 95px;" onchange="app.updateSummaryFilter()">
                                    ${monthOptions.map(m => `<option value="${m}" ${m === selectedMonthFrom ? 'selected' : ''}>Tháng ${m}</option>`).join('')}
                                </select>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <label style="font-weight: 600; color: var(--text-muted); font-size:0.85rem; white-space:nowrap;">Đến tháng:</label>
                                <select id="summary-month-to" class="form-control" style="width: 95px;" onchange="app.updateSummaryFilter()">
                                    ${monthOptions.map(m => `<option value="${m}" ${m === selectedMonthTo ? 'selected' : ''}>Tháng ${m}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                            <button class="btn btn-outline" style="border-color: #10b981; color: #10b981;" onclick="app.exportYearSummaryReport('${selectedYear}')">
                                <i class="fa-solid fa-file-excel"></i> Xuất Excel
                            </button>
                            <button class="btn btn-primary" onclick="window.print()">
                                <i class="fa-solid fa-print"></i> In Báo Cáo
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="glass-card" id="summary-report-inline" style="padding: 1.5rem; overflow-x: auto;">
                    <style>
                    @media print {
                        #summary-report-inline {
                            display: block !important;
                            background: #ffffff !important;
                            color: #000000 !important;
                            box-shadow: none !important;
                            border: none !important;
                            border-radius: 0 !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }
                        #summary-report-inline table {
                            border-collapse: collapse !important;
                            width: 100% !important;
                            border: 2px solid #000000 !important;
                        }
                        #summary-report-inline th,
                        #summary-report-inline td {
                            border: 1px solid #000000 !important;
                            padding: 6px 8px !important;
                            font-size: 0.82rem !important;
                            color: #000000 !important;
                            background: transparent !important;
                        }
                        #summary-report-inline thead tr,
                        #summary-report-inline tr.print-header-row {
                            background-color: #cbd5e1 !important;
                            font-weight: bold !important;
                        }
                        #summary-report-inline tr.print-bold-row {
                            background-color: #cbd5e1 !important;
                            font-weight: bold !important;
                        }
                        #summary-report-inline tr.print-sub-bold-row {
                            background-color: #f1f5f9 !important;
                            font-weight: bold !important;
                        }
                    }
                    </style>
                    <div style="text-align: center; margin-bottom: 1.5rem; color: var(--text-main);">
                        <h2 style="font-weight: 700; text-transform: uppercase; margin: 0 0 0.25rem 0; font-size: 1.4rem;">Bảng Tổng Hợp Doanh Thu - Chi Phí Năm ${selectedYear}</h2>
                        <h3 style="font-weight: 600; text-transform: uppercase; font-size: 1.05rem; color: var(--text-muted); margin: 0 0 0.5rem 0; letter-spacing: 0.5px;">Tàu Vũ Gia 05 - Vũ Gia 09 - Vũ Gia 15 - Vũ Gia 18 - Vũ Gia 36</h3>
                        <div style="text-align: right; font-style: italic; font-size: 0.88rem; color: var(--text-muted); padding-right: 5px;">ĐVT: 1.000Đ</div>
                    </div>
                    
                    <table class="report-print-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem; border: 1px solid #4a5568;">
                        <thead>
                            <tr style="background: #2d3a4a; color: #e2e8f0; font-weight: bold;">
                                <th rowspan="3" style="width: 60px; text-align: center; border: 1px solid #4a5568;">STT</th>
                                <th rowspan="3" style="width: 80px; text-align: center; border: 1px solid #4a5568;">TÀU</th>
                                <th rowspan="3" style="width: 110px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">DOANH THU</th>
                                <th colspan="10" style="text-align: center; border: 1px solid #4a5568;">CHI PHÍ</th>
                                <th rowspan="3" style="width: 110px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">Cộng chi</th>
                                <th rowspan="3" style="width: 120px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">TỒN CUỐI THÁNG</th>
                            </tr>
                            <tr style="background: #2d3a4a; color: #e2e8f0; font-weight: bold;">
                                <th colspan="2" style="text-align: center; border: 1px solid #4a5568;">Nhiên liệu</th>
                                <th rowspan="2" style="width: 90px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">Đại lý</th>
                                <th rowspan="2" style="width: 90px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">Chi tàu</th>
                                <th rowspan="2" style="width: 95px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">Chi lương</th>
                                <th rowspan="2" style="width: 90px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">Lãi NH</th>
                                <th rowspan="2" style="width: 90px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">Bảo hiểm</th>
                                <th rowspan="2" style="width: 90px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">VAT</th>
                                <th rowspan="2" style="width: 130px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">Sửa chữa /<br>Hoán cải / Vật tư</th>
                                <th rowspan="2" style="width: 100px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">Chi phí khác</th>
                            </tr>
                            <tr style="background: #2d3a4a; color: #e2e8f0; font-weight: bold;">
                                <th style="width: 80px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">DO</th>
                                <th style="width: 80px; text-align: right; border: 1px solid #4a5568; padding-right: 8px;">LO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHTML}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            // VOYAGE REPORT (Mặc định)
            const ships = AppData.getShipments().filter(s => s.contractNo && s.contractNo.trim() !== '');
            
            // Xây dựng danh sách các tháng có dữ liệu
            const monthsSet = new Set();
            ships.forEach(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (m) monthsSet.add(m);
            });
            const availableMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
            
            if (!filterMonth && availableMonths.length > 0) {
                filterMonth = availableMonths[0]; // Mặc định chọn tháng gần nhất
            }

            const monthShips = ships.filter(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                const matchesMonth = m === filterMonth;
                const matchesVessel = !filterVessel || s.vesselId === filterVessel;
                return matchesMonth && matchesVessel;
            }).sort((a, b) => {
                const numA = parseInt((a.contractNo || '').replace(/\D/g, '')) || 0;
                const numB = parseInt((b.contractNo || '').replace(/\D/g, '')) || 0;
                return numB - numA;
            });

            let totalRev = 0, totalCost = 0, totalProfit = 0;

            content = `
                <div class="glass-card" style="margin-bottom: 1.5rem; padding: 1rem 1.5rem;">
                    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
                        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 1rem;">
                            <div class="form-group" style="margin: 0; width: 180px;">
                                <label class="form-label" style="margin-bottom: 0.25rem;">Tháng hạch toán</label>
                                <select class="form-control" style="width: 100%;" onchange="app.navigate('reports', 'voyage', this.value, '${filterVessel}')">
                                    <option value="">-- Chọn tháng --</option>
                                    ${availableMonths.map(m => `<option value="${m}" ${m === filterMonth ? 'selected' : ''}>Tháng ${m.split('-')[1]}/${m.split('-')[0]}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="margin: 0; width: 180px;">
                                <label class="form-label" style="margin-bottom: 0.25rem;">Chọn Tàu</label>
                                <select class="form-control" style="width: 100%;" onchange="app.navigate('reports', 'voyage', '${filterMonth}', this.value)">
                                    <option value="">-- Tất cả tàu --</option>
                                    ${AppData.getVessels().map(v => `<option value="${v.id}" ${v.id === filterVessel ? 'selected' : ''}>${v.name}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 8px; align-items: flex-end; padding-top: 1.5rem;">
                            ${(filterVessel && filterMonth) ? `
                                <button class="btn btn-outline" style="border-color: var(--info); color: var(--info); font-weight: 600;" onclick="app.printMonthlyVesselReport('${filterVessel}', '${filterMonth}', false)">
                                    <i class="fa-solid fa-file-invoice"></i> Xem Báo Cáo Tháng
                                </button>
                                <button class="btn btn-primary" style="font-weight: 600;" onclick="app.printMonthlyVesselReport('${filterVessel}', '${filterMonth}', true)">
                                    <i class="fa-solid fa-print"></i> In Báo Cáo Tháng
                                </button>
                            ` : ''}
                            <button class="btn btn-outline" onclick="app.exportShipmentReport()"><i class="fa-solid fa-file-excel"></i> Xuất Excel Tất Cả</button>
                        </div>
                    </div>
                </div>

                <div class="glass-card">
                    <h3 style="color: var(--accent); margin-bottom: 1rem;"><i class="fa-solid fa-route"></i> Báo cáo Lợi nhuận Chuyến hàng - ${filterMonth ? 'Tháng ' + filterMonth.split('-')[1] + '/' + filterMonth.split('-')[0] : 'Tất cả'}</h3>
                    
                    ${monthShips.length === 0 ? '<p style="text-align:center; color:var(--text-muted); padding: 2rem;">Không có dữ liệu chuyến hàng trong tháng này.</p>' : `
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Mã HĐ</th>
                                    <th>Chuyến</th>
                                    <th>Tàu</th>
                                    <th>Hàng</th>
                                    <th>Khách hàng</th>
                                    <th style="text-align: right;">Doanh thu (VNĐ)</th>
                                    <th style="text-align: right;">Tổng chi phí (VNĐ)</th>
                                    <th style="text-align: right;">Lợi nhuận (VNĐ)</th>
                                    <th style="width: 100px; text-align: center;">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthShips.map(s => {
                                    const rev = Number(s.revenueReal || 0);
                                    
                                    const vat = Math.round((0.08 * (s.revenueInvoice || s.revenueReal)) - (0.10 * (s.costs?.fuelDO || 0)));
                                    const baseCosts = { ...s.costs };
                                    delete baseCosts.vat; // Tránh cộng dồn
                                    if (app.excludeDockingDepreciation) {
                                        delete baseCosts.dockingIntermediate;
                                        delete baseCosts.dockingPeriodic;
                                        delete baseCosts.depreciation;
                                    }
                                    const costSum = Object.values(baseCosts).reduce((sum, v) => sum + (Number(v) || 0), 0) + (vat > 0 ? vat : 0);
                                    
                                    const profit = rev - costSum;
                                    
                                    totalRev += rev;
                                    totalCost += costSum;
                                    totalProfit += profit;
                                    
                                    return `
                                        <tr>
                                            <td><strong>${s.contractNo || '---'}</strong></td>
                                            <td><span class="badge badge-outline">${s.voyageNo || '---'}</span></td>
                                            <td><span class="badge badge-success">${s.vesselId}</span></td>
                                            <td>${s.cargo}</td>
                                            <td>${s.customer}</td>
                                            <td style="text-align: right; color: var(--secondary);">${AppData.formatCurrency(rev)}</td>
                                            <td style="text-align: right; color: var(--rose-light);">${AppData.formatCurrency(costSum)}</td>
                                            <td style="text-align: right;" class="${profit >= 0 ? 'value-positive' : 'value-negative'}"><strong>${AppData.formatCurrency(profit)}</strong></td>
                                            <td>
                                                <div style="display: flex; gap: 4px; justify-content: center;">
                                                    <button class="btn btn-outline" style="padding: 0.2rem 0.4rem;" title="Xem Báo Cáo" onclick="app.openShipmentReport('${s.id}')"><i class="fa-solid fa-file-invoice-dollar" style="color:var(--success)"></i></button>
                                                    <button class="btn btn-outline" style="padding: 0.2rem 0.4rem;" title="In Báo Cáo" onclick="app.printShipmentReportDirectly('${s.id}')"><i class="fa-solid fa-print" style="color:var(--primary-light)"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                                <tr style="font-weight: 700; background: rgba(255,255,255,0.05); border-top: 2px solid var(--border-color);">
                                    <td colspan="5" style="text-align: center; color: var(--primary-light);">TỔNG CỘNG THÁNG</td>
                                    <td style="text-align: right; color: var(--secondary); font-size: 1.1rem;">${AppData.formatCurrency(totalRev)}</td>
                                    <td style="text-align: right; color: var(--rose-light); font-size: 1.1rem;">${AppData.formatCurrency(totalCost)}</td>
                                    <td style="text-align: right; font-size: 1.1rem;" class="${totalProfit >= 0 ? 'value-positive' : 'value-negative'}">${AppData.formatCurrency(totalProfit)}</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    `}
                </div>
            `;
        }

        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Báo cáo Tổng hợp</h1>
                        <p class="page-subtitle">Xem bảng theo dõi cấp dầu và hiệu quả chuyến hàng</p>
                    </div>
                </div>

                <div style="display:flex; gap:1rem; border-bottom:1px solid var(--border-color); margin-bottom:1.5rem;">
                    <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${currentTab === 'voyage' ? 'var(--primary-light)' : 'transparent'}; border-radius:0; font-weight: ${currentTab === 'voyage' ? 'bold' : 'normal'};" onclick="app.navigate('reports', 'voyage', '${filterMonth}', '${filterVessel}')">
                        <i class="fa-solid fa-route"></i> Báo cáo Chuyến hàng
                    </button>
                    <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${currentTab === 'fuel' ? 'var(--primary-light)' : 'transparent'}; border-radius:0; font-weight: ${currentTab === 'fuel' ? 'bold' : 'normal'};" onclick="app.navigate('reports', 'fuel', '${filterMonth}')">
                        <i class="fa-solid fa-gas-pump"></i> Bảng Theo Dõi Cấp DO
                    </button>
                    <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${currentTab === 'monthly' ? 'var(--primary-light)' : 'transparent'}; border-radius:0; font-weight: ${currentTab === 'monthly' ? 'bold' : 'normal'};" onclick="app.navigate('reports', 'monthly', '', '', '', '')">
                        <i class="fa-solid fa-file-invoice-dollar"></i> Báo cáo Tháng
                    </button>
                    <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${currentTab === 'summary' ? 'var(--primary-light)' : 'transparent'}; border-radius:0; font-weight: ${currentTab === 'summary' ? 'bold' : 'normal'};" onclick="app.navigate('reports', 'summary', '', '', '', '', '')">
                        <i class="fa-solid fa-list-check"></i> Báo cáo Tổng hợp
                    </button>
                    <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${currentTab === 'personal' ? 'var(--primary-light)' : 'transparent'}; border-radius:0; font-weight: ${currentTab === 'personal' ? 'bold' : 'normal'};" onclick="app.navigate('reports', 'personal', '', '', '', '', '', '')">
                        <i class="fa-solid fa-user-shield"></i> Sổ quỹ Cá nhân
                    </button>
                </div>

                ${content}
            </div>
        `;
    },

    'annual-costs': () => {
        const vessels = AppData.getVessels();
        const firstVesselId = vessels[0] ? vessels[0].id : '';
        const currentYear = new Date().getFullYear();
        
        // Find configuration for pre-filling or default
        const activeVesselId = app.annualCostsVesselId || firstVesselId;
        const activeYear = Number(app.annualCostsYear || currentYear);
        const config = AppData.getAnnualCosts(activeYear, activeVesselId);

        // Sum actual repair material costs for activeVesselId and activeYear
        const txs = AppData.getTransactions() || [];
        const actualDockingIntCost = txs
            .filter(t => t.vessel === activeVesselId && 
                         t.category === 'Vật tư sửa chữa trung gian' && 
                         t.date && 
                         new Date(t.date).getFullYear() === activeYear)
            .reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        const actualDockingPerCost = txs
            .filter(t => t.vessel === activeVesselId && 
                         t.category === 'Vật tư sửa chữa định kỳ' && 
                         t.date && 
                         new Date(t.date).getFullYear() === activeYear)
            .reduce((sum, t) => sum + (Number(t.chi) || 0), 0);
        
        // Build docking and registration schedule alerts for all vessels
        const reminders = [];
        vessels.forEach(v => {
            // Get config for the selected year for this vessel
            const vConfig = AppData.getAnnualCosts(activeYear, v.id);
            
            const getReminderInfo = (dateStr, label) => {
                if (!dateStr) return null;
                const today = new Date();
                today.setHours(0,0,0,0);
                const target = new Date(dateStr);
                if (isNaN(target.getTime())) return null; // Crash protection for invalid dates
                target.setHours(0,0,0,0);
                const diffTime = target - today;
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                
                let badgeClass = 'badge-success';
                let text = `Còn ${diffDays} ngày`;
                let style = 'border-left: 4px solid var(--secondary); background: rgba(0, 255, 100, 0.02);';
                
                if (diffDays < 0) {
                    badgeClass = 'badge-danger';
                    text = `Quá hạn ${Math.abs(diffDays)} ngày`;
                    style = 'border-left: 4px solid var(--rose-light); background: rgba(244, 63, 94, 0.05);';
                } else if (diffDays <= 30) {
                    badgeClass = 'badge-warning';
                    text = `Còn ${diffDays} ngày`;
                    style = 'border-left: 4px solid var(--warning); background: rgba(245, 158, 11, 0.05);';
                }
                
                return {
                    vesselId: v.id,
                    vesselName: v.name,
                    label,
                    date: target.toLocaleDateString('vi-VN'),
                    text,
                    badgeClass,
                    style,
                    diffDays
                };
            };
            
            const r1 = getReminderInfo(vConfig.dockingIntermediateDate, 'Lên đà trung gian');
            const r2 = getReminderInfo(vConfig.dockingPeriodicDate, 'Lên đà định kỳ');
            const r3 = getReminderInfo(vConfig.registryAnnualDate, 'Đăng kiểm hàng năm');
            
            if (r1) reminders.push(r1);
            if (r2) reminders.push(r2);
            if (r3) reminders.push(r3);
        });
        
        reminders.sort((a, b) => a.diffDays - b.diffDays);
        
        const remindersHtml = reminders.length === 0 
            ? `<div style="text-align:center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-bell-slash" style="font-size:2rem; margin-bottom:10px; display:block; opacity:0.5;"></i>Chưa cấu hình lịch lên đà / đăng kiểm.</div>`
            : reminders.map(r => `
                <div class="glass-panel" style="padding: 1rem; margin-bottom: 0.75rem; border-radius: 8px; ${r.style} display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
                    <div>
                        <strong style="color: var(--primary-light); font-size: 0.95rem;">${r.vesselName} (${r.vesselId})</strong>
                        <div style="font-size: 0.85rem; opacity: 0.8; margin-top: 4px;">${r.label}: <strong>${r.date}</strong></div>
                    </div>
                    <span class="badge ${r.badgeClass}" style="font-size: 0.8rem; padding: 4px 8px; border-radius: 4px;">${r.text}</span>
                </div>
            `).join('');
            
        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Chi phí Hàng năm & Lịch lên đà</h1>
                        <p class="page-subtitle">Nhập liệu chi phí cố định theo năm và theo dõi hạn đăng kiểm, lên đà của đội tàu</p>
                    </div>
                </div>
                
                <div class="grid-2" style="grid-template-columns: 1.1fr 1.9fr; gap: 1.5rem; align-items: start;">
                    <!-- Left: Docking & Registry Schedule -->
                    <div>
                        <div class="glass-card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
                            <h3 style="color: var(--accent); margin: 0 0 1rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-bell"></i> Lịch lên đà & Đăng kiểm nhắc nhở
                            </h3>
                            <div style="max-height: 480px; overflow-y: auto; padding-right: 4px;">
                                ${remindersHtml}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Right: Configuration inputs -->
                    <div class="glass-card" style="padding: 1.5rem;">
                        <h3 style="color: var(--info); margin: 0 0 1.25rem 0; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-sliders"></i> Thiết lập cấu hình Chi phí Phân bổ Hàng năm
                        </h3>
                        <form onsubmit="event.preventDefault(); app.saveAnnualCosts();">
                            <div class="grid-2" style="margin-bottom: 1.25rem;">
                                <div class="form-group">
                                    <label class="form-label">Chọn năm</label>
                                    <select class="form-control" id="a-year" onchange="app.loadAnnualCosts()">
                                        ${[2025, 2026, 2027, 2028, 2029, 2030].map(y => `<option value="${y}" ${y === activeYear ? 'selected' : ''}>Năm ${y}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Chọn tàu</label>
                                    <select class="form-control" id="a-vessel" onchange="app.loadAnnualCosts()">
                                        ${vessels.map(v => `<option value="${v.id}" ${v.id === activeVesselId ? 'selected' : ''}>${v.id} - ${v.name}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Intermediate Docking Section -->
                            <div style="border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1.25rem; background: rgba(0,0,0,0.15);">
                                <h4 style="margin: 0 0 0.75rem 0; color: var(--secondary); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-ship"></i> 1. Lên đà trung gian
                                </h4>
                                <div style="display: grid; grid-template-columns: 1.2fr 1.2fr 1fr 1.15fr; gap: 10px;">
                                    <div class="form-group" style="margin:0;"><label class="form-label">Chi phí ước tính (VNĐ)</label><input type="number" class="form-control" id="a-docking-int-cost" value="${config.dockingIntermediateCost || 0}"></div>
                                    <div class="form-group" style="margin:0;"><label class="form-label" style="color: var(--accent);">Vật tư thực tế (VNĐ)</label><input type="text" class="form-control" readonly style="background:rgba(255,255,255,0.05); color:var(--accent); text-align:right; font-weight:bold;" value="${AppData.formatCurrency(actualDockingIntCost)}"></div>
                                    <div class="form-group" style="margin:0;"><label class="form-label">Năm phân bổ</label><input type="number" step="any" class="form-control" id="a-docking-int-years" value="${config.dockingIntermediateYears || 2.5}"></div>
                                    <div class="form-group" style="margin:0;"><label class="form-label">Ngày lên đà tiếp</label><input type="date" class="form-control" id="a-docking-int-date" value="${config.dockingIntermediateDate || ''}"></div>
                                </div>
                            </div>

                            <!-- Periodic Docking Section -->
                            <div style="border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1.25rem; background: rgba(0,0,0,0.15);">
                                <h4 style="margin: 0 0 0.75rem 0; color: var(--secondary); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-anchor"></i> 2. Lên đà định kỳ
                                </h4>
                                <div style="display: grid; grid-template-columns: 1.2fr 1.2fr 1fr 1.15fr; gap: 10px;">
                                    <div class="form-group" style="margin:0;"><label class="form-label">Chi phí ước tính (VNĐ)</label><input type="number" class="form-control" id="a-docking-per-cost" value="${config.dockingPeriodicCost || 0}"></div>
                                    <div class="form-group" style="margin:0;"><label class="form-label" style="color: var(--accent);">Vật tư thực tế (VNĐ)</label><input type="text" class="form-control" readonly style="background:rgba(255,255,255,0.05); color:var(--accent); text-align:right; font-weight:bold;" value="${AppData.formatCurrency(actualDockingPerCost)}"></div>
                                    <div class="form-group" style="margin:0;"><label class="form-label">Năm phân bổ</label><input type="number" step="any" class="form-control" id="a-docking-per-years" value="${config.dockingPeriodicYears || 5}"></div>
                                    <div class="form-group" style="margin:0;"><label class="form-label">Ngày lên đà tiếp</label><input type="date" class="form-control" id="a-docking-per-date" value="${config.dockingPeriodicDate || ''}"></div>
                                </div>
                            </div>

                            <!-- Annual Registry Section -->
                            <div style="border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1.25rem; background: rgba(0,0,0,0.15);">
                                <h4 style="margin: 0 0 0.75rem 0; color: var(--secondary); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-file-shield"></i> 3. Đăng kiểm hàng năm
                                </h4>
                                <div class="grid-3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                    <div class="form-group" style="margin:0;"><label class="form-label">Chi phí (VNĐ)</label><input type="number" class="form-control" id="a-registry-ann-cost" value="${config.registryAnnualCost || 0}"></div>
                                    <div class="form-group" style="margin:0;"><label class="form-label">Năm phân bổ</label><input type="number" step="any" class="form-control" id="a-registry-ann-years" value="${config.registryAnnualYears || 1}"></div>
                                    <div class="form-group" style="margin:0;"><label class="form-label">Ngày đăng kiểm tiếp</label><input type="date" class="form-control" id="a-registry-ann-date" value="${config.registryAnnualDate || ''}"></div>
                                </div>
                            </div>

                            <!-- Depreciation, Hull Insurance and Large Repair Section -->
                            <div style="margin-bottom: 1.5rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                <div class="form-group" style="margin:0;"><label class="form-label"><i class="fa-solid fa-chart-line-down"></i> 4. Khấu hao năm (VNĐ)</label><input type="number" class="form-control" id="a-depreciation-cost" value="${config.depreciationCost || 0}"></div>
                                <div class="form-group" style="margin:0;"><label class="form-label"><i class="fa-solid fa-shield-halved"></i> 5. Bảo hiểm thân vỏ năm (VNĐ)</label><input type="number" class="form-control" id="a-hull-ins-cost" value="${config.hullInsuranceCost || 0}"></div>
                                <div class="form-group" style="margin:0;"><label class="form-label" style="color:var(--accent);"><i class="fa-solid fa-screwdriver-wrench"></i> 6. Sửa chữa lớn thực tế (VNĐ)</label><input type="number" class="form-control" id="a-large-repair-cost" readonly style="background:rgba(255,255,255,0.05); color:var(--accent); font-weight:bold;" value="${config.largeRepairCost || 0}"></div>
                            </div>

                            <button type="submit" class="btn btn-primary" style="width: 100%; font-weight: 700; height: 42px;">
                                <i class="fa-solid fa-floppy-disk"></i> LƯU CẤU HÌNH & TÍNH PHÂN BỔ LẠI
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }
};
