document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calculator-form');
    const resultsContainer = document.getElementById('results');
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


    form.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent default form submission behavior
        calculateMartingale(); // Trigger the main calculation function
    });

    /**
     * Gathers all input values from the HTML form.
     * Parses string values into appropriate number types (float or integer).
     * @returns {object} An object containing all form inputs, keyed by their semantic names.
     *                   Includes: direction, initialPrice, addDiffPercent, tpPercent, initialMargin,
     *                   addMarginBase, maxAdds, leverage, takerFee, makerFee, maintenanceMarginRate,
     *                   amountMultiplier, diffMultiplier.
     */
    function getFormInputs() {
        // Read values from form elements and parse them to their respective types.
        return {
            direction: document.getElementById('direction').value, // 'long' or 'short'
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
     * Validates the parsed user inputs from the form.
     * Checks for NaN, negative values, and logical constraints (e.g., leverage >= 1).
     * @param {object} inputs - The input object from `getFormInputs()`.
     * @returns {object} An errors object where keys are input field IDs and values are error messages.
     *                   Returns an empty object if all inputs are valid.
     */
    function validateInputs(inputs) {
        const errors = {};
        // Validate initialPrice: Must be a positive number.
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
     * Clears any previously displayed validation error messages from the DOM.
     * This function finds all elements with the class 'error-message' and removes them.
     */
    function clearValidationErrors() {
        const errorMessages = document.querySelectorAll('.error-message');
        errorMessages.forEach(msgElement => msgElement.remove());
    }

    /**
     * Displays validation errors in the DOM, positioning them near the respective input fields.
     * @param {object} errors - An object where keys are input field IDs and values are the error messages.
     *                        Example: `{'initial-price': 'Error message here'}`
     */
    function displayValidationErrors(errors) {
        for (const fieldId in errors) {
            const inputFieldElement = document.getElementById(fieldId);
            if (inputFieldElement) {
                // Find the parent '.form-group' to append the error message within the group
                const parentFormGroup = inputFieldElement.closest('.form-group');
                if (parentFormGroup) {
                    const errorSpan = document.createElement('span');
                    errorSpan.className = 'error-message'; // Assign class for styling
                    errorSpan.textContent = errors[fieldId]; // Set the error text
                    parentFormGroup.appendChild(errorSpan); // Add the error message to the DOM
                }
            }
        }
    }

    /**
     * Calculates details for the initial position (step 0).
     * @param {object} inputs - The validated form inputs.
     * @returns {object} Data for the initial step, including calculated values like quantity, TP price, etc.
     */
    /**
     * Calculates the trading fee for a given quantity, price, and fee percentage.
     * Fee = Quantity * Price * (FeePercent / 100).
     * @param {number} quantity - The quantity of the asset being traded.
     * @param {number} price - The price per unit of the asset.
     * @param {number} feePercent - The fee percentage (e.g., 0.075 for 0.075%).
     * @returns {number} The calculated trading fee. Returns 0 if inputs are invalid for fee calculation.
     */
    function calculateFee(quantity, price, feePercent) {
        // Basic validation for fee calculation parameters
        if (quantity <= 0 || price <= 0 || feePercent < 0) {
            return 0; // No fee if quantity/price is zero/negative or feePercent is negative
        }
        return quantity * price * (feePercent / 100); // Standard fee calculation formula
    }

    /**
     * Calculates all relevant details for the initial position (Step 0).
     * This includes entry price, quantity, margin, opening fee, take profit price, and profit considering fees.
     * @param {object} inputs - The validated form inputs object from `getFormInputs()`.
     * @returns {object} An object containing all data for the initial step.
     *                   Properties include: step, addPrice, addQuantity, addMargin, openingFee,
     *                   accumulatedOpeningFees, unrealizedPnl, avgPrice, tpPrice, tpProfit,
     *                   percentToTp, cumulativeDiffPercent, stepFundingCost.
     */
    function calculateInitialPosition(inputs) {
        const { initialPrice, initialMargin, leverage, direction, tpPercent, takerFee, fundingRate, fundingSettlements, maxAdds } = inputs;

        const initialQuantity = (initialMargin * leverage) / initialPrice;
        const initialTpPrice = initialPrice * (1 + (direction === 'long' ? tpPercent : -tpPercent) / 100);

        const openingFee = calculateFee(initialQuantity, initialPrice, takerFee);
        const closingFeeAtTp = calculateFee(initialQuantity, initialTpPrice, takerFee);

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
     * Adds a row to the results table in the DOM to display step data.
     * @param {object} stepData - Data for the current step (either initial or additional).
     * @param {boolean} [isInitialStep=false] - (Optional) Indicates if this is the initial step. Can be inferred from stepData.step.
     */
    function updateStepInDOM(stepData, isInitialStep = false) {
        const row = stepsTbody.insertRow();
        // Order of cells must match the table headers in index.html
        //加仓序号 | 理论委托价 | 理论委托量 | 本次保证金 | 开仓手续费 | 本次未实现盈亏 | 加仓后均价 | 本次止盈价 | 本次止盈收益 | 距止盈需涨/跌 (%)
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
     * Calculates details for one additional margin call (a single step in the Martingale sequence).
     * @param {object} inputs - The validated form inputs (e.g., initialPrice, addDiffPercent, etc.).
     * @param {object} previousStepCumulativeData - Cumulative data from the position's state *before* this current step
     *                                            (e.g., totalMargin, totalQuantity, avgPrice, accumulatedOpeningFees).
     * @param {number} stepNumber - The current additional step number (e.g., 1 for the first add, 2 for the second, etc.).
     * @returns {object|null} Data for the new step, including calculated prices, PNL, new cumulative totals, fees etc.
     *                        Returns null if calculation is not possible (e.g., calculated add price is <= 0).
     */
    function calculateAdditionalPositionStep(inputs, previousStepCumulativeData, stepNumber) {
        const { initialPrice, addDiffPercent, tpPercent, addMarginBase, leverage, amountMultiplier, diffMultiplier, direction, takerFee, fundingRate, fundingSettlements, maxAdds } = inputs;

        // Calculate margin for this specific additional step using the amount multiplier
        const currentAddMargin = addMarginBase * Math.pow(amountMultiplier, stepNumber - 1);

        // Calculate the target cumulative percentage difference from the initial price to trigger this additional step
        // This loop recalculates the target cumulative difference for the *current* step number using the diff multiplier.
        let cumulativeTargetDiffPercent = 0;
        for (let k = 1; k <= stepNumber; k++) { // k goes from 1 up to current stepNumber
            cumulativeTargetDiffPercent += addDiffPercent * Math.pow(diffMultiplier, k - 1);
        }

        // Calculate theoretical entry price for this additional step based on the cumulative difference
        let currentAddPrice; // Price at which this additional margin is deployed
        if (direction === 'long') {
            currentAddPrice = initialPrice * (1 - cumulativeTargetDiffPercent / 100);
        } else { // short
            currentAddPrice = initialPrice * (1 + cumulativeTargetDiffPercent / 100);
        }

        // Validate calculated price. If it's zero or negative, stop further calculations for this path.
        if (currentAddPrice <= 0) {
            const errorRow = stepsTbody.insertRow();
            errorRow.innerHTML = `<td colspan="10" style="text-align:center; color: red;">错误：计算出的加仓价格 (${currentAddPrice.toFixed(8)}) 无效，停止计算后续加仓。</td>`; // Colspan matches table columns
            return null; // Signal that this step failed
        }

        // Calculate quantity for this additional step
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
        const currentOpeningFee = calculateFee(currentAddQuantity, currentAddPrice, takerFee);
        // Accumulate opening fees from all steps so far
        const accumulatedOpeningFees = previousStepCumulativeData.accumulatedOpeningFees + currentOpeningFee;

        // Calculate profit before any fees for the entire position up to this step
        const profitBeforeFees = newTotalQuantity * Math.abs(currentTpPriceForStep - newCurrentAvgPrice);
        // Calculate closing fee for the entire position if TP is hit at this stage
        const closingFeeForTotalPositionAtTp = calculateFee(newTotalQuantity, currentTpPriceForStep, takerFee);
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
     * Calculates the final summary figures after all Martingale steps are processed.
     * @param {object} inputs - The validated form inputs.
     * @param {Array<object>} allStepsData - Array containing data objects from all processed steps (initial + additions).
     * @param {number} finalCumulativeAvgPrice - The final average price of the total position after all steps.
     * @param {number} finalCumulativeTotalMargin - The total margin invested across all steps.
     * @param {number} priceOfLastTrade - The price at which the last trade (initial or an addition) was executed. This is used for PNL calculation.
     * @param {number} finalCumulativeTotalQuantity - The total quantity of the asset held after all steps.
     * @returns {object} An object containing all summary figures (e.g., PNL, liquidation price, etc.).
     */
    function calculateSummary(inputs, allStepsData, finalCumulativeAvgPrice, finalCumulativeTotalMargin, priceOfLastTrade, finalCumulativeTotalQuantity) {
        const { direction, initialPrice, takerFee, tpPercent, maintenanceMarginRate } = inputs;
        let finalUnrealizedPnl = 0;
        let calculatedLiqPrice = NaN;
        let priceDiffFromStartToLastAddPercent = 0;
        let liqPriceDiffFromAvgPercent = NaN;
        const mmrDecimal = maintenanceMarginRate / 100;

        if (finalCumulativeTotalQuantity > 0) {
            if (allStepsData.length > 0) {
                if (direction === 'long') {
                    finalUnrealizedPnl = finalCumulativeTotalQuantity * (priceOfLastTrade - finalCumulativeAvgPrice);
                } else {
                    finalUnrealizedPnl = finalCumulativeTotalQuantity * (finalCumulativeAvgPrice - priceOfLastTrade);
                }
            }

            if (direction === 'long') {
                calculatedLiqPrice = finalCumulativeAvgPrice * (1 + mmrDecimal) - (finalCumulativeTotalMargin / finalCumulativeTotalQuantity);
            } else {
                calculatedLiqPrice = finalCumulativeAvgPrice * (1 - mmrDecimal) + (finalCumulativeTotalMargin / finalCumulativeTotalQuantity);
            }

            if (finalCumulativeAvgPrice !== 0 && !isNaN(calculatedLiqPrice) && calculatedLiqPrice > 0) {
                const diffToLiq = calculatedLiqPrice - finalCumulativeAvgPrice;
                liqPriceDiffFromAvgPercent = (diffToLiq / finalCumulativeAvgPrice) * 100;
            } else if (calculatedLiqPrice <= 0) {
                 liqPriceDiffFromAvgPercent = direction === 'long' ? -100 : 100;
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
            const finalClosingFee = calculateFee(finalCumulativeTotalQuantity, finalTpPriceForSummary, takerFee);
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
     * Updates the summary section in the DOM with calculated Martingale figures.
     * Also sets tooltips for each summary item for better user understanding.
     * @param {object} summaryData - An object containing all summary figures from `calculateSummary`.
     */
    function updateSummaryInDOM(summaryData) {
        const initialPriceFromForm = parseFloat(document.getElementById('initial-price').value) || 0;
        const totalFundingFeeSpan = document.getElementById('total-funding-fee'); // Get the new span

        finalAvgPriceSpan.textContent = summaryData.hasTrades ? summaryData.finalAvgPrice.toFixed(6) : initialPriceFromForm.toFixed(6);
        finalAvgPriceSpan.title = '所有加仓完成后，最终的总持仓平均成本价';

        totalMarginSpan.textContent = summaryData.totalMargin.toFixed(2);
        totalMarginSpan.title = '用户为所有仓位投入的总保证金（不含手续费）';

        finalUnrealizedPnlSpan.textContent = summaryData.finalUnrealizedPnl.toFixed(2);
        finalUnrealizedPnlSpan.title = '最后一次加仓完成时，总持仓相对其最终均价的未实现盈亏';

        if (summaryData.hasAdds) {
            priceDiffPercentSpan.textContent = `${summaryData.priceDiffPercentValue.toFixed(2)}%`;
        } else if (parseInt(document.getElementById('max-adds').value) <= 0) {
             priceDiffPercentSpan.textContent = 'N/A (无加仓)';
        } else {
            priceDiffPercentSpan.textContent = '0.00% (无实际加仓)';
        }
        priceDiffPercentSpan.title = '从第一次开仓价格到最后一次加仓价格的价格变动百分比';

        if (summaryData.hasTrades && !isNaN(summaryData.estimatedLiqPrice)) {
            if (summaryData.estimatedLiqPrice > 0) {
                liquidationPriceSpan.textContent = `${summaryData.estimatedLiqPrice.toFixed(6)} USDT`;
                liquidationPriceSpan.style.color = '#e74c3c';
            } else {
                liquidationPriceSpan.textContent = `已低于或等于0`;
                liquidationPriceSpan.style.color = '#e74c3c';
            }

            if (!isNaN(summaryData.liqDiffPercentValue)) {
                liqDiffPercentSpan.textContent = `${summaryData.liqDiffPercentValue.toFixed(2)}%`;
                const direction = document.getElementById('direction').value;
                liqDiffPercentSpan.style.color = (direction === 'long' && summaryData.liqDiffPercentValue < 0) || (direction === 'short' && summaryData.liqDiffPercentValue > 0) ? '#e74c3c' : '#2ecc71';
            } else {
                liqDiffPercentSpan.textContent = 'N/A';
                liqDiffPercentSpan.style.color = '#777';
            }
        } else {
            liquidationPriceSpan.textContent = '无法计算 (无持仓)';
            liquidationPriceSpan.style.color = '#777';
            liqDiffPercentSpan.textContent = 'N/A';
            liqDiffPercentSpan.style.color = '#777';
        }
        liquidationPriceSpan.title = '根据总保证金、最终均价及维持保证金率估算的理论爆仓价格（已考虑维持保证金率，但不含未实现盈亏和额外费用影响）';
        liqDiffPercentSpan.title = '从最终持仓均价到理论爆仓价格所需的价格变动百分比';

        // Display Total Funding Fee
        // Show '+' for positive (cost), default '-' for negative (gain). Format to 4 decimal places for precision.
        const fundingFeeText = summaryData.totalEstimatedFundingCost > 0 ? `+${summaryData.totalEstimatedFundingCost.toFixed(4)}` : summaryData.totalEstimatedFundingCost.toFixed(4);
        totalFundingFeeSpan.textContent = `${fundingFeeText} USDT`;
        totalFundingFeeSpan.title = '根据预估资金费率和结算次数, 以及每阶段持仓价值计算的总资金费用。正数为总支付，负数为总收到。';
        // Color coding for funding fee: red for cost (positive), green for gain (negative), default for zero
        totalFundingFeeSpan.style.color = summaryData.totalEstimatedFundingCost > 0 ? '#e74c3c' : (summaryData.totalEstimatedFundingCost < 0 ? '#2ecc71' : '#333');


        finalTpProfitSpan.textContent = summaryData.finalTpProfit.toFixed(2);
        finalTpProfitSpan.title = '若最终总持仓在最终止盈价平仓的理论总收益（已扣除所有开仓、平仓手续费及预估总资金费用）';
    }

    /**
     * Main function to trigger the Martingale calculation process.
     * It orchestrates getting inputs, validation, step-by-step calculation for initial and additional positions,
     * DOM updates for each step, and final summary calculation and display.
     * Handles error display and clearing for user inputs.
     */
    function calculateMartingale() {
        clearValidationErrors(); // 1. Clear any old error messages
        const inputs = getFormInputs(); // 2. Get all form inputs
        const validationErrors = validateInputs(inputs); // 3. Validate inputs

        // If there are validation errors, display them and stop processing
        if (Object.keys(validationErrors).length > 0) {
            displayValidationErrors(validationErrors);
            resultsContainer.style.display = 'none'; // Hide results section if inputs are invalid
            return;
        }

        stepsTbody.innerHTML = ''; // Clear previous results from the steps table
        const allStepsData = []; // Array to store data objects for each step (initial and additions)

        // --- Initial Position (Step 0) ---
        const initialStepData = calculateInitialPosition(inputs); // Calculate details for the first position
        updateStepInDOM(initialStepData, true); // Display initial step in the table
        allStepsData.push(initialStepData); // Store data for the initial step

        // Initialize cumulative tracking variables with data from the initial step.
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
            const additionalStepData = calculateAdditionalPositionStep(inputs, positionStateBeforeThisAdd, i);

            if (!additionalStepData) {
                // If calculation failed (e.g., invalid price), an error message is shown by calculateAdditionalPositionStep.
                // Stop processing further additions.
                break;
            }

            updateStepInDOM(additionalStepData, false); // Display this additional step in the table
            allStepsData.push(additionalStepData); // Store this step's data

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
        const summaryData = calculateSummary(
            inputs,
            allStepsData,
            currentCumulativeAvgPrice,
            currentCumulativeTotalMargin,
            priceOfLastTrade,
            currentCumulativeTotalQuantity
        );
        updateSummaryInDOM(summaryData); // Display these summary figures in the DOM

        resultsContainer.style.display = 'block'; // Make the results section visible
        resultsContainer.scrollIntoView({ behavior: 'smooth' }); // Smoothly scroll to the results
    }

    // --- Export to Image Functionality ---
    const exportButton = document.getElementById('export-image-btn');
    /**
     * Handles the "Export to Image" button click event.
     * Captures the content of the '.calculator-container' element using the html2canvas library
     * and initiates a download of the captured image as a PNG file.
     * Generates a dynamic filename based on current calculator inputs for easy identification.
     */
    exportButton.addEventListener('click', () => {
        const elementToCapture = document.querySelector('.calculator-container');
        if (!elementToCapture) {
            alert('无法找到要导出的元素。');
            return;
        }

        const resultsAreVisible = resultsContainer.style.display === 'block';
        if (!resultsAreVisible) {
            alert('请先进行计算，使结果可见后再导出。');
            return;
        }

        html2canvas(elementToCapture, {
            useCORS: true,
            logging: true,
            onclone: (clonedDocument) => {
                // Callback executed after cloning the DOM, before rendering.
                // Can be used for temporary modifications to the cloned DOM for the screenshot.
            }
        }).then(canvas => {
            const inputsForFilename = getFormInputs();

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

});