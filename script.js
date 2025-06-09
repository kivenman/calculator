/**
 * @file script.js
 * Handles the logic for two cryptocurrency contract calculators:
 * 1. Martingale Strategy Calculator
 * 2. Standard Contract Calculator
 * It includes input gathering, validation, core calculations, results display,
 * tab navigation between calculators, and image export functionality for Martingale.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Common DOM Elements ---
    // Note: Martingale-specific result elements are accessed within m_updateSummaryInDOM
    const resultsContainer = document.getElementById('results'); // Martingale results container
    const stepsTbody = document.getElementById('steps-tbody');   // Martingale steps table body

    // --- Martingale Calculator Elements & Event Listener ---
    const form = document.getElementById('calculator-form'); // Martingale form
    const stepsTbody = document.getElementById('steps-tbody');
    const finalAvgPriceSpan = document.getElementById('final-avg-price');
    const totalMarginSpan = document.getElementById('total-margin');
    const finalUnrealizedPnlSpan = document.getElementById('final-unrealized-pnl');
    const liquidationPriceSpan = document.getElementById('liquidation-price');
    const liqDiffPercentSpan = document.getElementById('liq-diff-percent');
    const priceDiffPercentSpan = document.getElementById('price-diff-percent');
    const finalTpProfitSpan = document.getElementById('final-tp-profit');

    // Add tooltips to static table headers once DOM is loaded
    // These provide explanations for each column in the results table.
    const tableHeadersTooltips = {
        '理论委托量': '根据保证金和杠杆计算得出 (计算公式: 保证金 * 杠杆 / 价格)',
        '本次保证金 (USDT)': '用户在此次开仓或加仓行为中实际投入的保证金金额',
        '开仓手续费 (USDT)': '本次开仓或加仓所支付的预估手续费 (计算公式: 委托量 * 委托价 * Taker费率)',
        '本次未实现盈亏 (USDT)': '按本次加仓价计算，总持仓对比最新均价的浮动盈亏 (计算公式: 总数量 * (当前加仓价 - 最新均价) (多头时))',
        '加仓后均价 (USDT)': '所有已执行仓位的平均成本价 (计算公式: 总价值 / 总数量)',
        '本次止盈价 (USDT)': '当前总持仓按此均价和止盈百分比计算出的止盈目标价格',
        '本次止盈收益 (USDT)': '若当前总持仓在此止盈价平仓的理论收益（已扣除所有累计开仓手续费和本次平仓手续费）',
        '距止盈需涨/跌 (%)': '从本次加仓价到本次止盈价所需的价格变动百分比'
    };
    document.querySelectorAll('#steps-table th').forEach(th => {
        const tooltipText = tableHeadersTooltips[th.textContent.trim()];
        if (tooltipText) {
            th.setAttribute('title', tooltipText);
        }
    });


    if (form) { // Ensure Martingale form exists
        form.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent default form submission behavior
            calculateMartingale(); // Trigger the main Martingale calculation
        });
    }

    // --- Martingale Calculator Helper Functions ---

    /**
     * Gathers all input values from the Martingale calculator HTML form.
     * Parses string values into appropriate number types (float or integer).
     * @returns {object} An object containing all form inputs for the Martingale calculator,
     *                   including direction, initialPrice, addDiffPercent, tpPercent, initialMargin,
     *                   addMarginBase, maxAdds, leverage, takerFee, makerFee, maintenanceMarginRate,
     *                   fundingRate, fundingSettlements, amountMultiplier, diffMultiplier.
     */
    function m_getFormInputs() {
        return {
            direction: document.getElementById('direction').value,
            initialPrice: parseFloat(document.getElementById('initial-price').value), // Starting price of the asset
            addDiffPercent: parseFloat(document.getElementById('add-diff-percent').value), // Percentage difference from initial price to trigger an additional position
            tpPercent: parseFloat(document.getElementById('tp-percent').value), // Take profit percentage from the average entry price
            initialMargin: parseFloat(document.getElementById('initial-margin').value), // USDT amount for the first order
            addMarginBase: parseFloat(document.getElementById('add-margin').value), // Base USDT amount for subsequent additional orders (before multipliers)
            maxAdds: parseInt(document.getElementById('max-adds').value), // Maximum number of times to add to the position
            leverage: parseFloat(document.getElementById('leverage').value), // Leverage multiplier
            takerFee: parseFloat(document.getElementById('taker-fee').value), // Taker fee percentage (e.g., 0.075 for 0.075%)
            makerFee: parseFloat(document.getElementById('maker-fee').value),
            maintenanceMarginRate: parseFloat(document.getElementById('maintenance-margin-rate').value),
            fundingRate: parseFloat(document.getElementById('funding-rate').value), // Estimated funding rate per settlement
            fundingSettlements: parseInt(document.getElementById('funding-settlements').value), // Estimated total number of funding settlements
            amountMultiplier: parseFloat(document.getElementById('amount-multiplier').value),
            diffMultiplier: parseFloat(document.getElementById('diff-multiplier').value)
        };
    }

    /**
     * Validates the parsed user inputs from the Martingale form.
     * Validates the parsed user inputs from the Martingale form.
     * Checks for NaN, negative values, and logical constraints (e.g., leverage >= 1).
     * @param {object} inputs - The input object from `m_getFormInputs()`.
     * @returns {object} An errors object where keys are input field IDs and values are error messages.
     *                   Returns an empty object if all inputs are valid.
     */
    function m_validateInputs(inputs) {
        const errors = {};
        // Example: Validate initialPrice: Must be a positive number.
        if (isNaN(inputs.initialPrice) || inputs.initialPrice <= 0) {
            errors['initial-price'] = '初始价格必须是大于0的数字。';
        }
        // Validate addDiffPercent: Must be a positive number for price difference.
        if (isNaN(inputs.addDiffPercent) || inputs.addDiffPercent <= 0) {
            errors['add-diff-percent'] = '加仓价差百分比必须是大于0的数字。';
        }
        // Validate tpPercent: Must be a positive number for take profit.
        if (isNaN(inputs.tpPercent) || inputs.tpPercent <= 0) {
            errors['tp-percent'] = '止盈百分比必须是大于0的数字。';
        }
        // Validate initialMargin: Must be a positive amount.
        if (isNaN(inputs.initialMargin) || inputs.initialMargin <= 0) {
            errors['initial-margin'] = '初始保证金必须是大于0的数字。';
        }
        // Validate addMarginBase: Must be a positive amount for additional margin.
        if (isNaN(inputs.addMarginBase) || inputs.addMarginBase <= 0) {
            errors['add-margin'] = '基础加仓保证金必须是大于0的数字。';
        }
        // Validate maxAdds: Cannot be negative; 0 is allowed (no additions).
        if (isNaN(inputs.maxAdds) || inputs.maxAdds < 0) {
            errors['max-adds'] = '最大加仓次数不能为负数。';
        }
        // Validate leverage: Must be at least 1.
        if (isNaN(inputs.leverage) || inputs.leverage < 1) {
            errors['leverage'] = '杠杆倍数必须是至少为1的数字。';
        }
        // Validate takerFee: Cannot be negative.
        if (isNaN(inputs.takerFee) || inputs.takerFee < 0) {
            errors['taker-fee'] = 'Taker 手续费率不能为负数。';
        }
        // Validate makerFee: Cannot be negative.
        if (isNaN(inputs.makerFee) || inputs.makerFee < 0) {
            errors['maker-fee'] = 'Maker 手续费率不能为负数。';
        }
        // Validate maintenanceMarginRate: Must be between 0 and 100.
        if (isNaN(inputs.maintenanceMarginRate) || inputs.maintenanceMarginRate < 0 || inputs.maintenanceMarginRate > 100) {
            errors['maintenance-margin-rate'] = '维持保证金率必须是0到100之间的数字。';
        }
        // Validate fundingRate: Can be any number (positive, negative, or zero).
        if (isNaN(inputs.fundingRate)) {
            errors['funding-rate'] = '预估资金费率必须是一个数字。';
        }
        // Validate fundingSettlements: Must be a non-negative integer.
        if (isNaN(inputs.fundingSettlements) || inputs.fundingSettlements < 0 || !Number.isInteger(inputs.fundingSettlements)) {
            errors['funding-settlements'] = '预估结算次数必须是非负整数。';
        }
        // Validate amountMultiplier: Must be positive for margin scaling.
        if (isNaN(inputs.amountMultiplier) || inputs.amountMultiplier <= 0) {
            errors['amount-multiplier'] = '加仓额倍数必须是大于0的数字。';
        }
        // Validate diffMultiplier: Must be positive for price difference scaling.
        if (isNaN(inputs.diffMultiplier) || inputs.diffMultiplier <= 0) {
            errors['diff-multiplier'] = '价差倍数必须是大于0的数字。';
        }
        return errors;
    }

    /**
     * Clears any previously displayed validation error messages from the Martingale form DOM.
     */
    function m_clearValidationErrors() {
        const errorMessages = document.querySelectorAll('#calculator-form .error-message');
        errorMessages.forEach(msgElement => msgElement.remove());
    }

    /**
     * Displays validation errors in the Martingale form DOM.
     * Displays validation errors in the Martingale form DOM, under respective input fields.
     * @param {object} errors - An object where keys are Martingale input field IDs and values are error messages.
     */
    function m_displayValidationErrors(errors) {
        for (const fieldId in errors) {
            const inputFieldElement = document.getElementById(fieldId); // Get the input field
            if (inputFieldElement) {
                const parentFormGroup = inputFieldElement.closest('.form-group'); // Find its parent form group
                if (parentFormGroup) {
                    // Remove any existing error message for this field first
                    const existingError = parentFormGroup.querySelector('.error-message');
                    if (existingError) existingError.remove();
                    // Create and append the new error message
                    const errorSpan = document.createElement('span');
                    errorSpan.className = 'error-message';
                    errorSpan.textContent = errors[fieldId];
                    parentFormGroup.appendChild(errorSpan);
                }
            }
        }
    }

    /**
     * Calculates the trading fee for a given quantity, price, and fee percentage for Martingale.
     * @param {number} quantity - The quantity of the asset being traded.
     * @param {number} price - The price per unit of the asset.
     * @param {number} feePercent - The fee percentage (e.g., 0.075 for 0.075%).
     * @returns {number} The calculated trading fee.
     */
    function m_calculateFee(quantity, price, feePercent) {
        // Basic validation for fee calculation parameters
        if (quantity <= 0 || price <= 0 || feePercent < 0) {
            return 0;
        }
        return quantity * price * (feePercent / 100);
    }

    /**
     * Calculates all relevant details for the Martingale initial position (Step 0).
     * This includes entry price, quantity, margin, opening fee, take profit price, and profit considering fees and funding.
     * @param {object} inputs - The validated form inputs object from `m_getFormInputs()`.
     * @returns {object} An object containing all data for the initial step (e.g., step, addPrice, addQuantity, avgPrice, tpPrice, tpProfit).
     */
    function m_calculateInitialPosition(inputs) {
        const { initialPrice, initialMargin, leverage, direction, tpPercent, takerFee, fundingRate, fundingSettlements, maxAdds } = inputs;

        // Calculate initial trade quantity based on margin, leverage, and price
        const initialQuantity = (initialMargin * leverage) / initialPrice;
        // Calculate theoretical take profit price for this initial position
        const initialTpPrice = initialPrice * (1 + (direction === 'long' ? tpPercent : -tpPercent) / 100);

        // Calculate opening and closing fees for this initial trade
        const openingFee = m_calculateFee(initialQuantity, initialPrice, takerFee);
        const closingFeeAtTp = m_calculateFee(initialQuantity, initialTpPrice, takerFee);

        const profitBeforeTradingFees = initialQuantity * Math.abs(initialTpPrice - initialPrice);
        let calculatedInitialTpProfit = profitBeforeTradingFees - openingFee - closingFeeAtTp;

        // Calculate funding cost for this step
        // Distribute total estimated settlements across the initial position and all potential add positions
        const fundingEventsPerVirtualStep = (maxAdds + 1) > 0 ? fundingSettlements / (maxAdds + 1) : 0;
        const initialPositionValue = initialQuantity * initialPrice;
        const stepFundingCost = initialPositionValue * (fundingRate / 100) * fundingEventsPerVirtualStep;
        calculatedInitialTpProfit -= stepFundingCost; // Subtract funding cost from TP profit

        let initialPercentToTp = 0;
        if (initialPrice !== 0) {
            initialPercentToTp = ((initialTpPrice - initialPrice) / initialPrice) * 100;
        }

        return {
            step: 0,
            addPrice: initialPrice,
            addQuantity: initialQuantity,
            addMargin: initialMargin,
            openingFee: openingFee,
            accumulatedOpeningFees: openingFee,
            stepFundingCost: stepFundingCost, // Store funding cost for this step
            unrealizedPnl: 0,
            avgPrice: initialPrice,
            tpPrice: initialTpPrice,
            tpProfit: calculatedInitialTpProfit,
            percentToTp: initialPercentToTp,
            cumulativeDiffPercent: 0
        };
    }

    /**
     * Adds a row to the Martingale results table in the DOM to display step data.
     * @param {object} stepData - Data for the current Martingale step.
     */
    function m_updateStepInDOM(stepData) {
        const row = stepsTbody.insertRow();
        row.insertCell().textContent = stepData.step;
        row.insertCell().textContent = stepData.addPrice.toFixed(6);

        const quantityCell = row.insertCell();
        quantityCell.textContent = stepData.addQuantity.toFixed(4);
        quantityCell.title = '根据保证金和杠杆计算得出'; // 理论委托量

        row.insertCell().textContent = stepData.addMargin.toFixed(2); // 本次保证金 (USDT)

        const openingFeeCell = row.insertCell();
        openingFeeCell.textContent = stepData.openingFee.toFixed(4);
        openingFeeCell.title = '本次开仓或加仓所支付的预估手续费'; // 开仓手续费 (USDT)

        const unrealizedPnlCell = row.insertCell();
        unrealizedPnlCell.textContent = stepData.unrealizedPnl.toFixed(2);
        unrealizedPnlCell.title = '按本次加仓价计算，持仓对比当前均价的浮动盈亏'; // 本次未实现盈亏 (USDT)

        const avgPriceCell = row.insertCell();
        avgPriceCell.textContent = stepData.avgPrice.toFixed(6);
        avgPriceCell.title = '所有已执行仓位的平均成本价'; // 加仓后均价 (USDT)

        const tpPriceCell = row.insertCell();
        tpPriceCell.textContent = stepData.tpPrice.toFixed(6);
        tpPriceCell.title = '当前总持仓按此均价和止盈百分比计算出的止盈目标价格'; // 本次止盈价 (USDT)

        const tpProfitCell = row.insertCell();
        tpProfitCell.textContent = stepData.tpProfit.toFixed(2);
        tpProfitCell.title = '若当前总持仓在此止盈价平仓的理论收益（已扣除所有累计开仓手续费、本次平仓手续费及本阶段预估资金费用）';

        const percentToTpCell = row.insertCell();
        percentToTpCell.textContent = `${stepData.percentToTp.toFixed(2)}%`;
        percentToTpCell.title = '从本次加仓价到本次止盈价所需的价格变动百分比'; // 距止盈需涨/跌 (%)
    }

    /**
     * Calculates details for one additional Martingale margin call.
     * Calculates details for one additional Martingale margin call (a single step in the Martingale sequence).
     * @param {object} inputs - The validated Martingale form inputs (e.g., initialPrice, addDiffPercent, etc.).
     * @param {object} previousStepCumulativeData - Cumulative data from the position's state *before* this current step
     *                                            (e.g., totalMargin, totalQuantity, avgPrice, accumulatedOpeningFees).
     * @param {number} stepNumber - The current additional step number (e.g., 1 for the first add, 2 for the second, etc.).
     * @returns {object|null} Data for the new step (e.g., addPrice, addQuantity, new avgPrice, tpPrice, tpProfit),
     *                        or null if calculation is not possible (e.g., calculated add price is <= 0).
     */
    function m_calculateAdditionalPositionStep(inputs, previousStepCumulativeData, stepNumber) {
        const { initialPrice, addDiffPercent, tpPercent, addMarginBase, leverage, amountMultiplier, diffMultiplier, direction, takerFee, fundingRate, fundingSettlements, maxAdds } = inputs;

        // Calculate margin for this specific additional step using the amount multiplier
        const currentAddMargin = addMarginBase * Math.pow(amountMultiplier, stepNumber - 1);

        // Calculate the target cumulative percentage difference from the initial price for this add step
        let cumulativeTargetDiffPercent = 0;
        for (let k = 1; k <= stepNumber; k++) {
            cumulativeTargetDiffPercent += addDiffPercent * Math.pow(diffMultiplier, k - 1);
        }

        // Calculate theoretical entry price for this additional step
        let currentAddPrice;
        if (direction === 'long') {
            currentAddPrice = initialPrice * (1 - cumulativeTargetDiffPercent / 100);
        } else { // short
            currentAddPrice = initialPrice * (1 + cumulativeTargetDiffPercent / 100);
        }

        // Validate calculated add price. If it's zero or negative, stop further calculations for this path.
        if (currentAddPrice <= 0) {
            const errorRow = stepsTbody.insertRow();
            // Display error directly in the table and halt further additions for this calculation run.
            errorRow.innerHTML = `<td colspan="10" style="text-align:center; color: red;">错误：计算出的加仓价格 (${currentAddPrice.toFixed(8)}) 无效，停止计算后续加仓。</td>`;
            return null;
        }

        // Calculate quantity for this additional step based on its margin, leverage, and add price
        const currentAddQuantity = (currentAddMargin * leverage) / currentAddPrice;

        // Update cumulative values by incorporating this additional step
        const newTotalMargin = previousStepCumulativeData.totalMargin + currentAddMargin;
        const newTotalQuantity = previousStepCumulativeData.totalQuantity + currentAddQuantity;

        // Calculate new total value of all assets in the position
        const newTotalValue = (previousStepCumulativeData.totalQuantity * previousStepCumulativeData.avgPrice) + (currentAddQuantity * currentAddPrice);
        // Calculate the new average entry price for the entire position
        const newCurrentAvgPrice = newTotalValue / newTotalQuantity;

        // Calculate unrealized PNL at the moment this additional position is opened.
        // This is based on the difference between the current add price and the new average price.
        let stepUnrealizedPnl = 0;
        if (direction === 'long') {
            stepUnrealizedPnl = newTotalQuantity * (currentAddPrice - newCurrentAvgPrice); // For long, PNL is (current price - avg price) * quantity
        } else { // short
            stepUnrealizedPnl = newTotalQuantity * (newCurrentAvgPrice - currentAddPrice); // For short, PNL is (avg price - current price) * quantity
        }

        // Calculate the take profit price if the entire position (up to this step) were to be closed
        let currentTpPriceForStep;
        if (direction === 'long') {
            currentTpPriceForStep = newCurrentAvgPrice * (1 + tpPercent / 100);
        } else { // short
            currentTpPriceForStep = newCurrentAvgPrice * (1 - tpPercent / 100);
        }

        // Calculate fees for this specific additional step
        const currentOpeningFee = m_calculateFee(currentAddQuantity, currentAddPrice, takerFee);
        // Accumulate opening fees from all steps so far
        const accumulatedOpeningFees = previousStepCumulativeData.accumulatedOpeningFees + currentOpeningFee;

        // Calculate profit before any fees for the entire position up to this step
        const profitBeforeFees = newTotalQuantity * Math.abs(currentTpPriceForStep - newCurrentAvgPrice);
        // Calculate closing fee for the entire position if TP is hit at this stage
        const closingFeeForTotalPositionAtTp = m_calculateFee(newTotalQuantity, currentTpPriceForStep, takerFee);
        // Calculate final take profit for this step, accounting for all opening fees and the closing fee for the total position
        let currentTpProfitWithFees = profitBeforeFees - accumulatedOpeningFees - closingFeeForTotalPositionAtTp;

        // Calculate and subtract funding cost for this step
        const fundingEventsPerVirtualStep = (maxAdds + 1) > 0 ? fundingSettlements / (maxAdds + 1) : 0;
        const currentPositionValue = newTotalQuantity * newCurrentAvgPrice; // Value after this add
        const stepFundingCost = currentPositionValue * (fundingRate / 100) * fundingEventsPerVirtualStep;
        currentTpProfitWithFees -= stepFundingCost;

        // Calculate percentage change required from current add price to the new TP price
        let percentToTp = 0;
        if (currentAddPrice !== 0) { // Avoid division by zero
            percentToTp = ((currentTpPriceForStep - currentAddPrice) / currentAddPrice) * 100;
        }

        return {
            step: stepNumber,
            addPrice: currentAddPrice,
            addQuantity: currentAddQuantity,
            addMargin: currentAddMargin,
            openingFee: currentOpeningFee,
            accumulatedOpeningFees: accumulatedOpeningFees,
            stepFundingCost: stepFundingCost, // Store funding cost for this step
            unrealizedPnl: stepUnrealizedPnl,
            avgPrice: newCurrentAvgPrice,
            tpPrice: currentTpPriceForStep,
            tpProfit: currentTpProfitWithFees,
            percentToTp: percentToTp,
            totalMargin: newTotalMargin,
            totalQuantity: newTotalQuantity,
            cumulativeDiffPercent: cumulativeTargetDiffPercent
        };
    }

    /**
     * Calculates the final summary figures for the Martingale strategy.
     * Calculates the final summary figures for the Martingale strategy after all steps are processed.
     * @param {object} inputs - The validated Martingale form inputs.
     * @param {Array<object>} allStepsData - Array containing data objects from all processed steps (initial + additions).
     * @param {number} finalCumulativeAvgPrice - The final average price of the total position after all steps.
     * @param {number} finalCumulativeTotalMargin - The total margin invested across all steps.
     * @param {number} priceOfLastTrade - The price at which the last trade (initial or an addition) was executed.
     * @param {number} finalCumulativeTotalQuantity - The total quantity of the asset held after all steps.
     * @returns {object} An object containing all summary figures (e.g., finalAvgPrice, totalMargin, unrealized PNL, liquidation price, fees, profit).
     */
    function m_calculateSummary(inputs, allStepsData, finalCumulativeAvgPrice, finalCumulativeTotalMargin, priceOfLastTrade, finalCumulativeTotalQuantity) {
        const { direction, initialPrice, takerFee, tpPercent, maintenanceMarginRate } = inputs;
        let finalUnrealizedPnl = 0;
        let calculatedLiqPrice = NaN; // Liquidation Price
        let priceDiffFromStartToLastAddPercent = 0; // Percentage difference from initial price to last add price
        let liqPriceDiffFromAvgPercent = NaN; // Percentage difference from average price to liquidation price
        const mmrDecimal = maintenanceMarginRate / 100; // Maintenance Margin Rate as a decimal

        // Calculate liquidation price only if there's a position
        if (finalCumulativeTotalQuantity <= 0) {
            calculatedLiqPrice = NaN;
        } else {
            // Determine PNL context price: if last trade happened, use its price, otherwise initial price.
            const priceForPnlContext = priceOfLastTrade !== 0 ? priceOfLastTrade : initialPrice;

            // Calculate Unrealized PNL and Liquidation Price based on direction
            if (direction === 'long') {
                finalUnrealizedPnl = finalCumulativeTotalQuantity * (priceForPnlContext - finalCumulativeAvgPrice);
                // Liquidation formula for Long positions (approximation)
                calculatedLiqPrice = finalCumulativeAvgPrice * (1 + mmrDecimal) - (finalCumulativeTotalMargin / finalCumulativeTotalQuantity);
                if (calculatedLiqPrice < 0) { // Liquidation price cannot be negative for a long position.
                    calculatedLiqPrice = 0;
                }
            } else { // Short
                finalUnrealizedPnl = finalCumulativeTotalQuantity * (finalCumulativeAvgPrice - priceForPnlContext);
                // Liquidation formula for Short positions (approximation)
                calculatedLiqPrice = finalCumulativeAvgPrice * (1 - mmrDecimal) + (finalCumulativeTotalMargin / finalCumulativeTotalQuantity);
            }

            // Calculate percentage difference to liquidation price
            if (finalCumulativeAvgPrice !== 0 && !isNaN(calculatedLiqPrice)) {
                if (calculatedLiqPrice >= 0) {
                    const diffToLiq = calculatedLiqPrice - finalCumulativeAvgPrice;
                    if (finalCumulativeAvgPrice === 0 && diffToLiq === 0) {
                        liqPriceDiffFromAvgPercent = 0;
                    } else if (finalCumulativeAvgPrice === 0 && diffToLiq !== 0) {
                        liqPriceDiffFromAvgPercent = (diffToLiq > 0) ? Infinity : -Infinity;
                    } else {
                        liqPriceDiffFromAvgPercent = (diffToLiq / finalCumulativeAvgPrice) * 100;
                    }
                } else {
                     liqPriceDiffFromAvgPercent = direction === 'long' ? -100 : Infinity;
                }
            } else if (isNaN(calculatedLiqPrice) && finalCumulativeAvgPrice === 0) {
                 liqPriceDiffFromAvgPercent = 0;
            }
        }

        const actualAddsCount = allStepsData.filter(s => s.step > 0).length;
        if (actualAddsCount > 0 && initialPrice !== 0 && priceOfLastTrade !== initialPrice) {
            priceDiffFromStartToLastAddPercent = ((priceOfLastTrade - initialPrice) / initialPrice) * 100;
        }

        // Calculate total estimated funding cost from all steps
        const totalEstimatedFundingCost = allStepsData.reduce((sum, step) => sum + (step.stepFundingCost || 0), 0);

        let finalTpProfitWithAllFees = 0;
        if (finalCumulativeTotalQuantity > 0) {
            const totalAccumulatedOpeningFees = allStepsData.reduce((sum, step) => sum + (step.openingFee || 0), 0);
            const finalTpPriceForSummary = finalCumulativeAvgPrice * (1 + (direction === 'long' ? tpPercent : -tpPercent) / 100);
            const finalClosingFee = m_calculateFee(finalCumulativeTotalQuantity, finalTpPriceForSummary, takerFee);
            const profitBeforeAllFees = finalCumulativeTotalQuantity * Math.abs(finalTpPriceForSummary - finalCumulativeAvgPrice);
            // Final TP profit after ALL fees (trading and funding)
            finalTpProfitWithAllFees = profitBeforeAllFees - totalAccumulatedOpeningFees - finalClosingFee - totalEstimatedFundingCost;
        } else {
            const initialStepData = allStepsData.find(step => step.step === 0);
            if (initialStepData) {
                finalTpProfitWithAllFees = initialStepData.tpProfit; // Already includes its share of funding cost & trading fees
            }
        }

        return {
            finalAvgPrice: finalCumulativeTotalQuantity > 0 ? finalCumulativeAvgPrice : initialPrice,
            totalMargin: finalCumulativeTotalMargin,
            finalUnrealizedPnl: finalUnrealizedPnl,
            estimatedLiqPrice: calculatedLiqPrice,
            priceDiffPercentValue: priceDiffFromStartToLastAddPercent,
            liqDiffPercentValue: liqPriceDiffFromAvgPercent,
            totalEstimatedFundingCost: totalEstimatedFundingCost, // Add this to summary data
            finalTpProfit: finalTpProfitWithAllFees,
            hasTrades: finalCumulativeTotalQuantity > 0,
            hasAdds: actualAddsCount > 0
        };
    }

    /**
     * Updates the Martingale summary section in the DOM.
     * Updates the Martingale summary section in the DOM with calculated figures.
     * Also sets tooltips for each summary item for better user understanding.
     * @param {object} summaryData - An object containing Martingale summary figures from `m_calculateSummary`.
     */
    function m_updateSummaryInDOM(summaryData) {
        // Retrieve DOM elements for summary display
        const finalAvgPriceSpan = document.getElementById('final-avg-price');
        const totalMarginSpan = document.getElementById('total-margin');
        const finalUnrealizedPnlSpan = document.getElementById('final-unrealized-pnl');
        const liquidationPriceSpan = document.getElementById('liquidation-price'); // Martingale liq price span
        const liqDiffPercentSpan = document.getElementById('liq-diff-percent');
        const priceDiffPercentSpan = document.getElementById('price-diff-percent');
        const totalFundingFeeSpan = document.getElementById('total-funding-fee');
        const finalTpProfitSpan = document.getElementById('final-tp-profit');

        const initialPriceFromForm = parseFloat(document.getElementById('initial-price').value) || 0;

        finalAvgPriceSpan.textContent = summaryData.hasTrades ? summaryData.finalAvgPrice.toFixed(6) : initialPriceFromForm.toFixed(6);
        finalAvgPriceSpan.title = '所有加仓完成后，最终的总持仓平均成本价';

        totalMarginSpan.textContent = summaryData.totalMargin.toFixed(2);
        totalMarginSpan.title = '用户为所有仓位投入的总保证金（不含手续费）';

        finalUnrealizedPnlSpan.textContent = summaryData.finalUnrealizedPnl.toFixed(2);
        finalUnrealizedPnlSpan.title = '最后一次加仓完成时，总持仓相对其最终均价的未实现盈亏';

        if (summaryData.hasAdds) {
            priceDiffPercentSpan.textContent = `${summaryData.priceDiffPercentValue.toFixed(2)}%`;
        } else if (parseInt(document.getElementById('max-adds').value) <= 0) { // Check if maxAdds was 0
             priceDiffPercentSpan.textContent = 'N/A (无加仓)';
        } else {
            priceDiffPercentSpan.textContent = '0.00% (无实际加仓)';
        }
        priceDiffPercentSpan.title = '从第一次开仓价格到最后一次加仓价格的价格变动百分比';

        // Display Martingale Liquidation Price and related percentage difference
        if (summaryData.hasTrades && !isNaN(summaryData.estimatedLiqPrice)) {
            if (summaryData.estimatedLiqPrice > 0) {
                liquidationPriceSpan.textContent = `${summaryData.estimatedLiqPrice.toFixed(6)} USDT`;
                liquidationPriceSpan.style.color = '#e74c3c'; // Red for danger
            } else { // Includes 0 for longs after flooring
                liquidationPriceSpan.textContent = `≤0.000000 USDT`; // Indicate at or below zero
                liquidationPriceSpan.style.color = '#e74c3c';
            }

            if (!isNaN(summaryData.liqDiffPercentValue) && isFinite(summaryData.liqDiffPercentValue)) {
                liqDiffPercentSpan.textContent = `${summaryData.liqDiffPercentValue.toFixed(2)}%`;
                const direction = document.getElementById('direction').value;
                // Color based on whether the liquidation is in the adverse direction
                liqDiffPercentSpan.style.color = (direction === 'long' && summaryData.liqDiffPercentValue < 0) || (direction === 'short' && summaryData.liqDiffPercentValue > 0) ? '#e74c3c' : '#2ecc71';
            } else if (summaryData.liqDiffPercentValue === Infinity || summaryData.liqDiffPercentValue === -Infinity) {
                liqDiffPercentSpan.textContent = (summaryData.liqDiffPercentValue > 0 ? '+' : '') + '∞%';
                liqDiffPercentSpan.style.color = '#2ecc71'; // Green, very safe
            }
             else {
                liqDiffPercentSpan.textContent = 'N/A';
                liqDiffPercentSpan.style.color = '#777'; // Default/grey for N/A
            }
        } else { // No trades or NaN liquidation price
            liquidationPriceSpan.textContent = '无法计算 (无持仓)';
            liquidationPriceSpan.style.color = '#777';
            liqDiffPercentSpan.textContent = 'N/A';
            liqDiffPercentSpan.style.color = '#777';
        }
        liquidationPriceSpan.title = '根据总保证金、最终均价及维持保证金率估算的理论爆仓价格。';
        liqDiffPercentSpan.title = '从最终持仓均价到理论爆仓价格所需的价格变动百分比。';

        // Display Total Funding Fee
        const fundingFeeText = summaryData.totalEstimatedFundingCost > 0 ? `+${summaryData.totalEstimatedFundingCost.toFixed(4)}` : summaryData.totalEstimatedFundingCost.toFixed(4);
        totalFundingFeeSpan.textContent = `${fundingFeeText} USDT`;
        totalFundingFeeSpan.title = '根据预估资金费率和结算次数, 以及每阶段持仓价值计算的总资金费用。正数为总支付，负数为总收到。';
        totalFundingFeeSpan.style.color = summaryData.totalEstimatedFundingCost > 0 ? '#e74c3c' : (summaryData.totalEstimatedFundingCost < 0 ? '#2ecc71' : '#333');

        finalTpProfitSpan.textContent = summaryData.finalTpProfit.toFixed(2);
        finalTpProfitSpan.title = '若最终总持仓在最终止盈价平仓的理论总收益（已扣除所有开仓、平仓手续费及预估总资金费用）。';
    }

    /**
     * Main function to trigger the Martingale calculation process.
     * It orchestrates getting inputs, validation, step-by-step calculation for initial and additional positions,
     * DOM updates for each step, and final summary calculation and display.
     * Main function to trigger the Martingale calculation process.
     * Orchestrates getting inputs, validation, step-by-step calculation for initial and additional positions,
     * DOM updates for each step, and final summary calculation and display.
     */
    function calculateMartingale() {
        m_clearValidationErrors(); // Clear previous errors from Martingale form
        const inputs = m_getFormInputs();
        const validationErrors = m_validateInputs(inputs);

        if (Object.keys(validationErrors).length > 0) {
            m_displayValidationErrors(validationErrors); // Display new errors
            resultsContainer.style.display = 'none'; // Hide results if inputs invalid
            return;
        }

        stepsTbody.innerHTML = ''; // Clear previous results from the steps table
        const allStepsData = []; // Array to store data for each step

        // --- Initial Position (Step 0) ---
        const initialStepData = m_calculateInitialPosition(inputs);
        m_updateStepInDOM(initialStepData); // Add initial step to table
        allStepsData.push(initialStepData);

        // Initialize cumulative tracking variables from the initial step
        // These variables will be updated iteratively as each additional position is calculated.
        let currentCumulativeTotalMargin = initialStepData.addMargin;
        let currentCumulativeTotalQuantity = initialStepData.addQuantity;
        let currentCumulativeAvgPrice = initialStepData.avgPrice;
        let priceOfLastTrade = initialStepData.addPrice; // Tracks the entry price of the most recent trade
        let currentAccumulatedOpeningFees = initialStepData.accumulatedOpeningFees; // Tracks sum of opening fees

        // --- Loop for Additional Positions (Steps 1 to maxAdds) ---
        for (let i = 1; i <= inputs.maxAdds; i++) {
            // Prepare data bundle representing the position's state *before* this current additional step
            const positionStateBeforeThisAdd = {
                avgPrice: currentCumulativeAvgPrice,
                totalQuantity: currentCumulativeTotalQuantity,
                totalMargin: currentCumulativeTotalMargin,
                accumulatedOpeningFees: currentAccumulatedOpeningFees
            };

            // Calculate details for the current additional position step
            const additionalStepData = m_calculateAdditionalPositionStep(inputs, positionStateBeforeThisAdd, i);

            if (!additionalStepData) {
                // If calculation failed, an error message is shown by m_calculateAdditionalPositionStep.
                break;
            }

            m_updateStepInDOM(additionalStepData);
            allStepsData.push(additionalStepData);

            // Update cumulative tracking variables with results from the current additional step
            currentCumulativeTotalMargin = additionalStepData.totalMargin;
            currentCumulativeTotalQuantity = additionalStepData.totalQuantity;
            currentCumulativeAvgPrice = additionalStepData.avgPrice;
            priceOfLastTrade = additionalStepData.addPrice;
            currentAccumulatedOpeningFees = additionalStepData.accumulatedOpeningFees;
        }

        // --- Final Summary Calculation ---
        // If no actual margin additions were made (only initial position exists, or maxAdds was 0),
        // the 'priceOfLastTrade' for summary PNL should be the initial price to reflect PNL against initial entry.
        if (allStepsData.filter(s => s.step > 0).length === 0) {
            priceOfLastTrade = inputs.initialPrice;
        }

        // Calculate all final summary figures based on the complete set of processed steps
        const summaryData = m_calculateSummary(
            inputs,
            allStepsData,
            currentCumulativeAvgPrice,
            currentCumulativeTotalMargin,
            priceOfLastTrade,
            currentCumulativeTotalQuantity
        );
        m_updateSummaryInDOM(summaryData);

        resultsContainer.style.display = 'block';
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    // --- Export to Image Functionality (Martingale specific for now) ---
    const exportButton = document.getElementById('export-image-btn');
    if (exportButton) { // Ensure button exists before adding listener
        exportButton.addEventListener('click', () => {
            // Select the Martingale calculator's content area for image capture
            const elementToCapture = document.getElementById('martingale-calculator-content');
            if (!elementToCapture) {
                alert('无法找到马丁格尔计算器内容进行导出。'); // Error if element not found
                return;
            }
            // Ensure Martingale results are actually visible before attempting export
            const martingaleResultsDisplay = elementToCapture.querySelector('#results');
            if (!martingaleResultsDisplay || martingaleResultsDisplay.style.display === 'none') {
                alert('请先进行马丁格尔计算，使结果可见后再导出。'); // User guidance
                return;
            }

            // Use html2canvas to capture the specified element
            html2canvas(elementToCapture, {
                useCORS: true, // Enable CORS if loading external images/assets (though not used here)
                logging: true, // Enable logging for debugging html2canvas issues
                onclone: (clonedDocument) => {
                    // This callback runs after the DOM is cloned but before rendering to canvas.
                    // Useful for making temporary changes to the cloned DOM for the screenshot.
                    // For instance, ensuring results are visible if they were hidden by other means.
                    const clonedResults = clonedDocument.getElementById('results');
                    if (clonedResults) clonedResults.style.display = 'block'; // Force display of results in clone
                }
            }).then(canvas => {
                const inputsForFilename = m_getFormInputs(); // Get current Martingale inputs for filename

                // Helper functions for formatting numbers in the filename
                const formatNumForFilename = (num, decimals = 2) => (isNaN(Number(num)) ? 'NaN' : Number(num).toFixed(decimals));
                const formatIntForFilename = (num) => (isNaN(parseInt(num)) ? 'NaN' : parseInt(num));

            // Construct filename with key parameters
            const filenameParts = [
                'Martingale',
                inputsForFilename.direction === 'long' ? 'Long' : 'Short',
                `P${formatNumForFilename(inputsForFilename.initialPrice, 6)}`,
                `Diff${formatNumForFilename(inputsForFilename.addDiffPercent)}`,
                `TP${formatNumForFilename(inputsForFilename.tpPercent)}`,
                `N${formatIntForFilename(inputsForFilename.maxAdds)}`,
                `L${formatIntForFilename(inputsForFilename.leverage)}x`,
                `TF${formatNumForFilename(inputsForFilename.takerFee, 3)}`,
                `MF${formatNumForFilename(inputsForFilename.makerFee, 3)}`,
                `MMR${formatNumForFilename(inputsForFilename.maintenanceMarginRate, 1)}`,
                `FR${formatNumForFilename(inputsForFilename.fundingRate, 4)}`, // Funding Rate
                `FS${formatIntForFilename(inputsForFilename.fundingSettlements)}`, // Funding Settlements
                `AM${formatNumForFilename(inputsForFilename.amountMultiplier)}`,
                `DM${formatNumForFilename(inputsForFilename.diffMultiplier)}`
            ];
            const filename = filenameParts.join('_') + '.png';

            const safeFilename = filename.replace(/[\/\\:*?"<>|]/g, '_');

            const link = document.createElement('a');
            link.download = safeFilename; 
            link.href = canvas.toDataURL('image/png');
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        }).catch(err => {
            console.error('导出图片失败:', err);
            alert('导出图片失败，请查看控制台获取更多信息。');
        });
    });

    // --- Standard Contract Calculator Global Elements & Event Listener ---
    const stdForm = document.getElementById('standard-calculator-form'); // Standard calculator form
    const stdResultsContainer = document.getElementById('std-results');   // Standard calculator results container
    const stdCalculateBtn = document.getElementById('std-calculate-btn'); // Standard calculator calculate button

    if (stdCalculateBtn) { // Check if the button exists
        stdCalculateBtn.addEventListener('click', () => {
            calculateStandardContract(); // Trigger main Standard Contract calculation
        });
    }

    // --- Tab Navigation (Shared Functionality) ---
    /**
     * Initializes tab navigation functionality.
     * Allows switching between different calculator interfaces.
     */
    function initTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn'); // All tab buttons
        const calculatorContents = document.querySelectorAll('.calculator-content'); // All content sections for tabs

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab; // Get target tab from data attribute

                // Deactivate all tab buttons
                tabButtons.forEach(btn => btn.classList.remove('active'));
                // Activate the clicked tab button
                button.classList.add('active');

                // Hide all calculator content sections and show the target one
                calculatorContents.forEach(content => {
                    // Toggle 'hidden' class based on whether the content ID matches the target tab
                    content.classList.toggle('hidden', content.id !== `${targetTab}-calculator-content`);
                });
            });
        });
        // Note: Default active tab is set via HTML classes.
    }

    // --- Standard Contract Calculator Helper Functions ---

    /**
     * Gathers inputs from the Standard Contract calculator form.
     * Converts percentages to decimals.
     * @returns {object} Parsed inputs for the Standard calculator, including direction, entryPrice,
     *                   exitPrice, quantity, leverage, takerFeeRate (decimal), maintenanceMarginRate (decimal).
     */
    function s_getInputs() {
        const takerFeePercent = parseFloat(document.getElementById('std-taker-fee').value);
        const maintenanceMarginRatePercent = parseFloat(document.getElementById('std-maintenance-margin-rate').value);

        return {
            direction: document.getElementById('std-direction').value,
            entryPrice: parseFloat(document.getElementById('std-entry-price').value),
            exitPrice: parseFloat(document.getElementById('std-exit-price').value),
            quantity: parseFloat(document.getElementById('std-quantity').value),
            leverage: parseFloat(document.getElementById('std-leverage').value),
            takerFeeRate: isNaN(takerFeePercent) ? 0 : takerFeePercent / 100, // Convert to decimal
            maintenanceMarginRate: isNaN(maintenanceMarginRatePercent) ? 0 : maintenanceMarginRatePercent / 100, // Convert to decimal
        };
    }

    /**
     * Validates inputs for the Standard Contract calculator.
     * @param {object} inputs - Parsed inputs from `s_getInputs()`.
     * @returns {object} An errors object where keys are input field IDs and values are error messages.
     *                   Returns an empty object if all inputs are valid.
     */
    function s_validateInputs(inputs) {
        const errors = {};
        if (isNaN(inputs.entryPrice) || inputs.entryPrice <= 0) {
            errors['std-entry-price'] = '开仓价格必须是大于0的数字。';
        }
        if (isNaN(inputs.exitPrice) || inputs.exitPrice <= 0) {
            errors['std-exit-price'] = '平仓价格必须是大于0的数字。';
        }
        if (isNaN(inputs.quantity) || inputs.quantity <= 0) {
            errors['std-quantity'] = '开仓数量必须是大于0的数字。';
        }
        if (isNaN(inputs.leverage) || inputs.leverage < 1) {
            errors['std-leverage'] = '杠杆倍数必须至少为1。';
        }
        // Validate original percentage values for user feedback context
        const originalTakerFee = parseFloat(document.getElementById('std-taker-fee').value);
        if (isNaN(originalTakerFee) || originalTakerFee < 0) {
            errors['std-taker-fee'] = 'Taker 手续费率不能为负数。';
        }
        const originalMaintenanceMarginRate = parseFloat(document.getElementById('std-maintenance-margin-rate').value);
        if (isNaN(originalMaintenanceMarginRate) || originalMaintenanceMarginRate < 0 || originalMaintenanceMarginRate >= 100) {
            errors['std-maintenance-margin-rate'] = '维持保证金率必须是0到小于100之间的数字。';
        }
        return errors;
    }

    /**
     * Main calculation function for the Standard Contract calculator.
     * It orchestrates input gathering, validation, calculation of PNL, ROE, fees, and liquidation price,
     * and then displays these results.
     */
    function calculateStandardContract() {
        s_clearValidationErrors(); // Clear previous errors
        const inputs = s_getInputs(); // Get parsed inputs
        const errors = s_validateInputs(inputs); // Validate them

        if (Object.keys(errors).length > 0) {
            s_displayValidationErrors(errors); // Show errors
            stdResultsContainer.style.display = 'none'; // Hide results area
            return;
        }

        const { direction, entryPrice, exitPrice, quantity, leverage, takerFeeRate, maintenanceMarginRate: mmrDecimal } = inputs;

        let pnl = 0;
        let liquidationPrice = NaN; // Default to NaN, indicating it might not be calculable

        // Calculate Initial Margin: (Entry Price * Quantity) / Leverage
        const initialMargin = (entryPrice * quantity) / leverage;
        // Calculate Opening Fee: Entry Price * Quantity * Taker Fee Rate
        const openingFee = entryPrice * quantity * takerFeeRate;
        // Calculate Closing Fee: Exit Price * Quantity * Taker Fee Rate
        const closingFee = exitPrice * quantity * takerFeeRate;
        const totalFees = openingFee + closingFee;

        // Calculate PNL and Liquidation Price based on trade direction
        if (direction === 'long') {
            // PNL for Long: (Exit Price - Entry Price) * Quantity - Total Fees
            pnl = (exitPrice - entryPrice) * quantity - totalFees;
            // New Liquidation Price formula for Long
            if (mmrDecimal >= 1) { // Maintenance margin rate cannot be 100% or more
                liquidationPrice = NaN;
            } else if (leverage <= 0 || (1 - mmrDecimal) === 0) { // Avoid division by zero or invalid leverage
                liquidationPrice = NaN;
            } else {
                liquidationPrice = entryPrice * (1 - (1 / leverage)) / (1 - mmrDecimal);
                if (liquidationPrice < 0) { // Liquidation price cannot be negative for a long.
                    liquidationPrice = 0;
                }
            }
        } else { // Short
            // PNL for Short: (Entry Price - Exit Price) * Quantity - Total Fees
            pnl = (entryPrice - exitPrice) * quantity - totalFees;
            // New Liquidation Price formula for Short
            if (mmrDecimal <= -1 || (1 + mmrDecimal) === 0) { // MMR cannot be -100% or less, or make denominator zero.
                liquidationPrice = NaN;
            } else if (leverage <= 0) { // Invalid leverage
                liquidationPrice = NaN;
            } else {
                liquidationPrice = entryPrice * (1 + (1 / leverage)) / (1 + mmrDecimal);
                // A negative liquidation price for a short is usually not meaningful.
                if (liquidationPrice < 0) liquidationPrice = NaN;
            }
        }

        // ROE %: (PNL / Initial Margin) * 100
        const roe = (initialMargin > 0) ? (pnl / initialMargin) * 100 : 0; // Avoid division by zero if no margin

        const results = {
            pnl: pnl,
            roe: roe,
            liquidationPrice: liquidationPrice,
            totalFees: totalFees,
            initialMargin: initialMargin
        };

        s_displayResults(results); // Display the calculated results
        stdResultsContainer.style.display = 'block'; // Make results visible
        stdResultsContainer.scrollIntoView({ behavior: 'smooth' }); // Scroll to results
    }

    /**
     * Displays calculated results for the Standard Contract calculator in the UI.
     * Formats numbers and handles NaN/Infinity values.
     * @param {object} results - An object containing calculated PNL, ROE, Liquidation Price, and Total Fees.
     */
    function s_displayResults(results) {
        const pnlEl = document.getElementById('std-pnl');
        const roeEl = document.getElementById('std-roe');
        const liqPriceEl = document.getElementById('std-liquidation-price');
        const feesEl = document.getElementById('std-total-fees');

        // Display PNL, formatted to 2 decimal places, or "N/A" if not a number.
        pnlEl.textContent = isNaN(results.pnl) ? 'N/A' : results.pnl.toFixed(2);
        // Display ROE, formatted to 2 decimal places with a "%" sign, or "N/A" if not a finite number.
        roeEl.textContent = isNaN(results.roe) || !isFinite(results.roe) ? 'N/A' : results.roe.toFixed(2) + '%';

        // Display Liquidation Price with special handling for NaN or zero values.
        const currentDirection = document.getElementById('std-direction').value;
        if (isNaN(results.liquidationPrice)) {
            liqPriceEl.textContent = '无法计算'; // "Cannot Calculate" for NaN
        } else if (results.liquidationPrice === 0 && currentDirection === 'long') {
            liqPriceEl.textContent = '≤0.000000'; // Indicate at or below zero for long positions
        } else {
            liqPriceEl.textContent = results.liquidationPrice.toFixed(6); // Format to 6 decimal places
        }
        // Display Total Fees, formatted to 4 decimal places, or "N/A" if not a number.
        feesEl.textContent = isNaN(results.totalFees) ? 'N/A' : results.totalFees.toFixed(4);
    }

    /**
     * Clears previously displayed validation error messages from the Standard calculator form.
     */
    function s_clearValidationErrors() {
        const errorMessages = document.querySelectorAll('#standard-calculator-form .error-message');
        errorMessages.forEach(msgElement => msgElement.remove());
    }

    /**
     * Displays validation errors for the Standard calculator form fields.
     * @param {object} errors - An object where keys are Standard calculator input field IDs and values are error messages.
     */
    function s_displayValidationErrors(errors) {
        for (const fieldId in errors) {
            const inputFieldElement = document.getElementById(fieldId);
            if (inputFieldElement) {
                const parentFormGroup = inputFieldElement.closest('.form-group');
                if (parentFormGroup) {
                    const existingError = parentFormGroup.querySelector('.error-message');
                    if (existingError) existingError.remove(); // Remove old error first
                    const errorSpan = document.createElement('span');
                    errorSpan.className = 'error-message';
                    errorSpan.textContent = errors[fieldId];
                    parentFormGroup.appendChild(errorSpan); // Add new error
                }
            }
        }
    }

    // Initialize tab navigation on DOMContentLoaded
    initTabNavigation();
});