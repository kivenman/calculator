# 马丁格尔合约计算器 (Martingale Contract Calculator)

## 描述 (Description)
一个用于USDT本位合约的马丁格尔策略理论计算和模拟的网页工具。用户可以输入多种参数，模拟马丁格尔策略在不同市场行情下的表现，包括逐次加仓详情、平均成本、预估爆仓价、以及考虑手续费、维持保证金率和预估资金费用后的理论止盈收益。

(A web-based tool for theoretical calculation and simulation of the Martingale strategy for USDT-margined contracts. Users can input various parameters to simulate the strategy's performance under different market conditions, including step-by-step position increase details, average cost, estimated liquidation price, and theoretical take-profit returns after considering trading fees, maintenance margin rates, and estimated funding fees.)

## 功能特性 (Features)
*   **灵活的参数输入 (Flexible Input Parameters):**
    *   开仓方向 (Long/Short)
    *   首次开仓价格 (Initial Price)
    *   加仓价差百分比 (Add Position Threshold %)
    *   单周期止盈目标 (%) (Take Profit Target %)
    *   首次下单保证金 (Initial Margin)
    *   基础加仓保证金 (Base Add Margin)
    *   最大加仓次数 (Max Adds)
    *   杠杆倍数 (Leverage)
    *   加仓金额倍数 (Amount Multiplier)
    *   加仓价差倍数 (Diff Multiplier)
    *   Taker 手续费 (%) (Taker Fee %)
    *   Maker 手续费 (%) (Maker Fee %)
    *   维持保证金率 (%) (Maintenance Margin Rate %)
    *   预估资金费率 (%) (Estimated Funding Rate %)
    *   预估结算次数 (Estimated Funding Settlements)
*   **详细的计算结果 (Detailed Calculation Results):**
    *   **逐次加仓详情 (Step-by-step Details):**
        *   加仓序号 (Step Number)
        *   理论委托价 (Theoretical Entry Price)
        *   理论委托量 (Theoretical Quantity)
        *   本次保证金 (Margin for this Step)
        *   开仓手续费 (Opening Fee for this Step)
        *   本次未实现盈亏 (Unrealized P&L at this Step)
        *   加仓后均价 (Average Entry Price after this Step)
        *   本次止盈价 (Take Profit Price for current total position)
        *   本次止盈收益 (Take Profit amount for current total position, trading and estimated funding fees deducted)
        *   距止盈需涨/跌 (%) (Percentage to TP from current add price)
    *   **总体概要 (Overall Summary):**
        *   最终持仓成本 (均价) (Final Average Entry Price)
        *   总体所需保证金 (Total Required Margin by user)
        *   最后一次加仓时未实现盈亏 (Unrealized P&L at last add)
        *   理论爆仓价格 (Theoretical Liquidation Price)
        *   距爆仓价差 (%) (Percentage difference to Liquidation Price)
        *   首尾价差 (%) (Percentage difference between first and last entry price)
        *   预估总资金费用 (Total Estimated Funding Fee)
        *   最终止盈理论收益 (Final Theoretical Take Profit, all fees deducted including funding)
*   **结果导出 (Export Results):**
    *   可以将计算结果区域导出为图片 (PNG) 保存。 (Export results area as a PNG image).

## 如何使用 (How to Use)
1.  在浏览器中打开 `index.html` 文件。 (Open the `index.html` file in a web browser.)
2.  在表单中填入各项参数。 (Fill in the parameters in the form.)
3.  点击“计算”按钮查看结果。 (Click the "计算" (Calculate) button to see the results.)
4.  可选，点击“导出为图片”按钮将结果区域保存为图片。 (Optionally, click the "导出为图片" (Export to Image) button to save a screenshot of the results area.)

## 输入参数详解 (Input Parameters Explained)
*   **开仓方向 (Direction):** 选择“做多”或“做空”。 (Choose "Long" or "Short".)
*   **第一次开仓价格 (USDT) (Initial Price USDT):** 您首次建立仓位的币种价格。 (The asset price at which you open your first position.)
*   **涨/跌多少加仓 (%) (Add Position Threshold %):** 相对于“首次开仓价格”，当价格向不利方向变动达到此百分比时，执行一次加仓。 (When the price moves unfavorably by this percentage relative to the "Initial Price", an additional position is opened.)
*   **单周期止盈目标 (%) (Take Profit Target %):** 基于当前总持仓的平均成本价，当价格向有利方向变动达到此盈利百分比时，理论上应全部平仓止盈。 (Based on the average cost price of the current total position, when the price moves favorably by this percentage, the entire position is theoretically closed for profit.)
*   **首次下单保证金 (USDT) (Initial Margin USDT):** 您为第一个订单投入的保证金金额。 (The amount of margin you allocate for the first order.)
*   **加仓单保证金 (基础, USDT) (Base Add Margin USDT):** 后续每次加仓时，作为计算基础的保证金金额。实际加仓保证金会受“加仓金额倍数”的影响。 (The base margin amount used for calculating subsequent additional positions. The actual margin for an add is affected by the "Amount Multiplier".)
*   **最大加仓次数 (Max Adds):** 允许策略执行的最大追加保证金/加仓的次数。 (The maximum number of times the strategy is allowed to add to the position.)
*   **杠杆倍数 (Leverage):** 您在交易中使用的杠杆倍数。 (The leverage multiplier used for trading.)
*   **加仓金额倍数 (Amount Multiplier):** 用于计算每次加仓的实际保证金。计算公式为：`本次加仓保证金 = 基础加仓保证金 * (加仓金额倍数 ^ (加仓序号 - 1))`。例如，基础保证金10 USDT，倍数1.5：第1次加仓保证金为10 USDT (10 * 1.5^0)，第2次为15 USDT (10 * 1.5^1)，第3次为22.5 USDT (10 * 1.5^2)，以此类推。 (Multiplier for the margin of subsequent additions. Formula: `Current Add Margin = Base Add Margin * (Amount Multiplier ^ (Add Step Number - 1))`. E.g., if Base is 10, Multiplier is 1.5: 1st add margin = 10 * 1.5^0 = 10; 2nd add = 10 * 1.5^1 = 15; 3rd add = 10 * 1.5^2 = 22.5.)
*   **加仓价差倍数 (Diff Multiplier):** 影响后续加仓的触发价差。每次加仓的触发价差百分比 = `(涨/跌多少加仓 %)` * (`加仓价差倍数` ^ (`加仓序号` - 1))。这个计算出的百分比用于确定从初始价格开始累计的下一个加仓点的触发价格。 (Influences the price difference that triggers subsequent additions. The specific percentage difference for step `i` = `(Add Position Threshold %)` * (`Diff Multiplier` ^ (`i` - 1)). This percentage is part of the calculation for the cumulative price difference from the initial price that triggers the add.)
*   **Taker 手续费 (%) (Taker Fee %):** 吃单（市价单）成交时支付的手续费率。计算器中，所有开仓和平仓均按此费率估算。 (Fee rate for orders that take liquidity (market orders). In this calculator, all opening and closing trades are estimated using this rate.)
*   **Maker 手续费 (%) (Maker Fee %):** 挂单（限价单）成交时支付的手续费率。当前计算器主要使用Taker费率，此项可为未来扩展预留。 (Fee rate for orders that make liquidity (limit orders). Currently, the calculator primarily uses the Taker Fee for simplicity; this field is for future extension.)
*   **维持保证金率 (%) (Maintenance Margin Rate %):** 交易所要求的，维持仓位所需的最低保证金占仓位价值的百分比。用于估算理论爆仓价格。 (The minimum percentage of margin required by the exchange to maintain an open position, relative to the position's value. Used for estimating the theoretical liquidation price.)
*   **预估资金费率 (%) (Estimated Funding Rate %):** 每次资金结算时预估的费率。正数表示您支付资金费，负数表示您收到资金费。例如，0.01表示支付0.01%的费率。该费率会影响理论止盈收益的计算。总的资金费用会根据预估结算次数、各阶段的持仓价值和此费率来估算。 (Estimated rate per funding settlement. Positive means you pay, negative means you receive. E.g., 0.01 for a 0.01% rate paid. This rate affects the calculation of theoretical take-profit. Total funding cost is estimated based on settlement count, position value at each stage, and this rate.)
*   **预估结算次数 (Estimated Funding Settlements):** 在整个马丁格尔策略周期内（从首次开仓到最终止盈平仓）预估发生资金结算的总次数。总的预估资金费用会按比例分配到策略的每一个阶段（首次开仓和每次加仓）中进行估算并从各阶段的止盈收益中扣除/增加。 (Total estimated number of funding settlements during the entire Martingale strategy cycle, from initial opening to final take-profit closure. The total estimated funding cost is proportionally distributed across each stage of the strategy (initial open and each addition) for estimation and is deducted from/added to the take-profit of each stage.)

## 免责声明 (Disclaimer)
本计算器结果仅供理论参考，不构成任何投资建议。实际交易结果可能因市场波动、手续费、滑点、资金费率、具体交易所的爆仓机制及计算方式、账户整体风险等多种因素影响而产生差异。请务必谨慎使用，并结合实际情况进行决策。

(The results from this calculator are for theoretical reference only and do not constitute any investment advice. Actual trading results may differ due to various factors such as market volatility, actual fees, slippage, funding rates, specific exchange liquidation mechanisms and calculation methods, overall account risk, etc. Please use with caution and make decisions based on your actual situation.)
