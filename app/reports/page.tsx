"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ArrowLeft, TrendingUp, Clock, User, DollarSign, RotateCcw, Calendar, TrendingDown } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface Sale {
  id: string
  employee_id: string
  items: Array<{
    product: {
      id: string
      name: string
      price: number
    }
    quantity: number
  }>
  total: number
  payment_method: "cash" | "school-cash"
  created_at: string
}

interface Product {
  id: string
  name: string
  price: number
  unit_cost?: number
  quantity: number
}

export default function ReportsPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [currentCash, setCurrentCash] = useState(0)
  const [startingCash, setStartingCash] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "week" | "month">("today")
  const [hasCostData, setHasCostData] = useState(false)

  useEffect(() => {
    loadData()

    // Set up real-time subscriptions
    const salesSubscription = supabase
      .channel("sales-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => {
        loadSales()
      })
      .subscribe()

    const productsSubscription = supabase
      .channel("products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        loadProducts()
      })
      .subscribe()

    const cashSubscription = supabase
      .channel("cash-register-reports-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cash_register",
        },
        (payload) => {
          console.log("Cash register updated in reports:", payload.new)
          setCurrentCash(payload.new.current_amount || 0)
          setStartingCash(payload.new.starting_amount || 0)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(salesSubscription)
      supabase.removeChannel(productsSubscription)
      supabase.removeChannel(cashSubscription)
    }
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    await Promise.all([loadSales(), loadProducts(), loadCashRegister()])
    setIsLoading(false)
  }

  const loadSales = async () => {
    try {
      const { data, error } = await supabase.from("sales").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setSales(data || [])
    } catch (error) {
      console.error("Error loading sales:", error)
    }
  }

  const loadProducts = async () => {
    try {
      // First, try to get the table structure to check if unit_cost column exists
      const { data: tableInfo, error: tableError } = await supabase.from("products").select("*").limit(1)

      let hasUnitCost = false
      if (tableInfo && tableInfo.length > 0) {
        hasUnitCost = "unit_cost" in tableInfo[0]
      }

      let data, error
      if (hasUnitCost) {
        // Load with unit_cost column
        const result = await supabase.from("products").select("id, name, price, unit_cost, quantity")
        data = result.data
        error = result.error
        setHasCostData(true)
      } else {
        // Load without unit_cost column
        const result = await supabase.from("products").select("id, name, price, quantity")
        data = result.data
        error = result.error
        setHasCostData(false)
      }

      if (error) throw error

      // Map the data and ensure unit_cost defaults to 0 if not present
      const mappedProducts = (data || []).map((product) => ({
        ...product,
        unit_cost: product.unit_cost || 0,
      }))

      setProducts(mappedProducts)
    } catch (error) {
      console.error("Error loading products:", error)

      // Fallback: try loading basic product data without unit_cost
      try {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("products")
          .select("id, name, price, quantity")

        if (fallbackError) throw fallbackError

        const mappedProducts = (fallbackData || []).map((product) => ({
          ...product,
          unit_cost: 0,
        }))

        setProducts(mappedProducts)
        setHasCostData(false)
      } catch (fallbackError) {
        console.error("Error loading products (fallback):", fallbackError)
        setProducts([])
        setHasCostData(false)
      }
    }
  }

  const loadCashRegister = async () => {
    try {
      const { data, error } = await supabase.from("cash_register").select("current_amount, starting_amount").single()

      if (error) {
        console.error("Error loading cash register:", error)
        return
      }

      setCurrentCash(data.current_amount || 0)
      setStartingCash(data.starting_amount || 0)
    } catch (error) {
      console.error("Error loading cash register:", error)
    }
  }

  const getFilteredSales = () => {
    const now = new Date()
    return sales.filter((sale) => {
      const saleDate = new Date(sale.created_at)

      switch (selectedPeriod) {
        case "today":
          return saleDate.toDateString() === now.toDateString()
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          return saleDate >= weekAgo
        case "month":
          const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1)
          return saleDate >= monthAgo
        default:
          return true
      }
    })
  }

  const filteredSales = getFilteredSales()

  // Calculate profits (only if we have cost data)
  const calculateProfits = () => {
    if (!hasCostData) {
      return { totalRevenue: 0, totalCost: 0, totalProfit: 0 }
    }

    let totalRevenue = 0
    let totalCost = 0
    let totalProfit = 0

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const product = products.find((p) => p.id === item.product.id)
        const revenue = item.product.price * item.quantity
        const cost = product ? (product.unit_cost || 0) * item.quantity : 0

        totalRevenue += revenue
        totalCost += cost
        totalProfit += revenue - cost
      })
    })

    return { totalRevenue, totalCost, totalProfit }
  }

  const { totalRevenue, totalCost, totalProfit } = calculateProfits()
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  // Separate cash and school cash sales
  const cashSales = filteredSales.filter((sale) => sale.payment_method === "cash")
  const schoolCashSales = filteredSales.filter((sale) => sale.payment_method === "school-cash")

  const totalSalesAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0)
  const cashSalesAmount = cashSales.reduce((sum, sale) => sum + sale.total, 0)
  const schoolCashSalesAmount = schoolCashSales.reduce((sum, sale) => sum + sale.total, 0)
  const totalTransactions = filteredSales.length
  const averageTransaction = totalTransactions > 0 ? totalSalesAmount / totalTransactions : 0

  // Product sales summary with profit calculation
  const productSales = filteredSales.reduce(
    (acc, sale) => {
      sale.items.forEach((item) => {
        const product = products.find((p) => p.id === item.product.id)
        const unitCost = product ? product.unit_cost || 0 : 0
        const revenue = item.product.price * item.quantity
        const cost = unitCost * item.quantity
        const profit = revenue - cost

        if (acc[item.product.name]) {
          acc[item.product.name].quantity += item.quantity
          acc[item.product.name].revenue += revenue
          acc[item.product.name].cost += cost
          acc[item.product.name].profit += profit
        } else {
          acc[item.product.name] = {
            quantity: item.quantity,
            revenue: revenue,
            cost: cost,
            profit: profit,
          }
        }
      })
      return acc
    },
    {} as Record<string, { quantity: number; revenue: number; cost: number; profit: number }>,
  )

  const topProducts = Object.entries(productSales)
    .sort(([, a], [, b]) => b.quantity - a.quantity)
    .slice(0, 5)

  const mostProfitableProducts = Object.entries(productSales)
    .sort(([, a], [, b]) => b.profit - a.profit)
    .slice(0, 5)

  const handleMonthlyReset = async () => {
    setIsResetting(true)

    try {
      // Archive current month's data by adding a note or keeping it
      // For now, we'll just clear the sales data
      const { error: salesError } = await supabase
        .from("sales")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")

      if (salesError) throw salesError

      // Reset cash register to starting amount
      const { data: cashRegister, error: fetchError } = await supabase.from("cash_register").select("*").single()

      if (fetchError) throw fetchError

      const { error: cashError } = await supabase
        .from("cash_register")
        .update({
          current_amount: 0,
          starting_amount: 0,
          updated_by: "monthly_reset",
        })
        .eq("id", cashRegister.id)

      if (cashError) throw cashError

      // Reload data
      await loadData()

      setShowResetDialog(false)
      alert("Monthly reset completed successfully! All sales data has been cleared and cash register has been reset.")
    } catch (error) {
      console.error("Error performing monthly reset:", error)
      alert("Error performing monthly reset. Please try again.")
    } finally {
      setIsResetting(false)
    }
  }

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case "today":
        return "Today's"
      case "week":
        return "This Week's"
      case "month":
        return "This Month's"
      default:
        return "Today's"
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-slate-600">Loading reports...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100">
      {/* Header */}
      <header className="bg-teal-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-white hover:bg-teal-700">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Sales Reports {hasCostData ? "& Profit Analysis" : ""}</h1>
                <p className="text-teal-100">{getPeriodLabel()} performance summary</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Period Selection */}
              <div className="flex gap-1 bg-white/10 rounded-lg p-1">
                <Button
                  variant={selectedPeriod === "today" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedPeriod("today")}
                  className="text-white hover:bg-white/20"
                >
                  Today
                </Button>
                <Button
                  variant={selectedPeriod === "week" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedPeriod("week")}
                  className="text-white hover:bg-white/20"
                >
                  Week
                </Button>
                <Button
                  variant={selectedPeriod === "month" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedPeriod("month")}
                  className="text-white hover:bg-white/20"
                >
                  Month
                </Button>
              </div>

              {/* Monthly Reset Button */}
              <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Monthly Reset
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Monthly Reset
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800 font-medium mb-2">⚠️ Warning</p>
                      <p className="text-sm text-amber-700">
                        This will permanently delete all sales data and reset the cash register to $0.00. This action
                        cannot be undone.
                      </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600 mb-2">Current Data Summary:</p>
                      <ul className="text-sm text-slate-700 space-y-1">
                        <li>• Total Sales: ${totalSalesAmount.toFixed(2)}</li>
                        <li>• Total Transactions: {totalTransactions}</li>
                        <li>• Current Cash: ${currentCash.toFixed(2)}</li>
                        {hasCostData && <li>• Total Profit: ${totalProfit.toFixed(2)}</li>}
                      </ul>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleMonthlyReset}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        disabled={isResetting}
                      >
                        {isResetting ? "Resetting..." : "Confirm Reset"}
                      </Button>
                      <Button variant="outline" onClick={() => setShowResetDialog(false)} disabled={isResetting}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Cost Data Warning */}
        {!hasCostData && (
          <Card className="border-amber-200 bg-amber-50 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2 rounded-full">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-amber-800">Profit Analysis Not Available</p>
                  <p className="text-sm text-amber-700">
                    Add unit costs to your products to enable profit tracking and analysis.{" "}
                    <Link href="/products" className="underline font-medium">
                      Go to Products →
                    </Link>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className={`grid grid-cols-1 md:grid-cols-${hasCostData ? "5" : "4"} gap-6 mb-6`}>
          <Card className="border-teal-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">${totalSalesAmount.toFixed(2)}</div>
              <p className="text-xs text-slate-500">{getPeriodLabel().toLowerCase()} revenue</p>
            </CardContent>
          </Card>

          {hasCostData && (
            <>
              <Card className="border-red-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Total Costs</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">${totalCost.toFixed(2)}</div>
                  <p className="text-xs text-slate-500">Product costs</p>
                </CardContent>
              </Card>

              <Card className="border-green-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Total Profit</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">${totalProfit.toFixed(2)}</div>
                  <p className="text-xs text-slate-500">{profitMargin.toFixed(1)}% margin</p>
                </CardContent>
              </Card>
            </>
          )}

          <Card className="border-teal-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Transactions</CardTitle>
              <Clock className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{totalTransactions}</div>
              <p className="text-xs text-slate-500">Sales completed</p>
            </CardContent>
          </Card>

          <Card className="border-teal-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Cash Register</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${currentCash.toFixed(2)}</div>
              <p className="text-xs text-slate-500">Current amount</p>
            </CardContent>
          </Card>
        </div>

        {/* Profit Analysis - Only show if we have cost data */}
        {hasCostData && (
          <Card className="border-green-200 mb-6">
            <CardHeader>
              <CardTitle className="text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Profit Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Gross Profit</p>
                  <p className="text-2xl font-bold text-green-600">${totalProfit.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">Revenue - Costs</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Profit Margin</p>
                  <p className="text-2xl font-bold text-blue-600">{profitMargin.toFixed(1)}%</p>
                  <p className="text-xs text-slate-500">Profit / Revenue</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Avg Profit/Sale</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ${totalTransactions > 0 ? (totalProfit / totalTransactions).toFixed(2) : "0.00"}
                  </p>
                  <p className="text-xs text-slate-500">Per transaction</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Cost Ratio</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {totalSalesAmount > 0 ? ((totalCost / totalSalesAmount) * 100).toFixed(1) : "0.0"}%
                  </p>
                  <p className="text-xs text-slate-500">Costs / Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Method Breakdown */}
        <Card className="border-teal-200 mb-6">
          <CardHeader>
            <CardTitle className="text-slate-800">Payment Method Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">Cash Sales</p>
                <p className="text-2xl font-bold text-green-600">${cashSalesAmount.toFixed(2)}</p>
                <p className="text-xs text-slate-500">{cashSales.length} transactions</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">School Cash Sales</p>
                <p className="text-2xl font-bold text-blue-600">${schoolCashSalesAmount.toFixed(2)}</p>
                <p className="text-xs text-slate-500">{schoolCashSales.length} transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most Profitable Products - Only show if we have cost data */}
          {hasCostData && (
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-slate-800 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Most Profitable Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mostProfitableProducts.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No sales data available</p>
                ) : (
                  <div className="space-y-3">
                    {mostProfitableProducts.map(([productName, data], index) => (
                      <div key={productName} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">#{index + 1}</Badge>
                          <div>
                            <h4 className="font-medium text-slate-800">{productName}</h4>
                            <p className="text-sm text-slate-600">{data.quantity} sold</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">${data.profit.toFixed(2)}</p>
                          <p className="text-xs text-slate-500">
                            ${data.revenue.toFixed(2)} - ${data.cost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Top Selling Products */}
          <Card className="border-teal-200">
            <CardHeader>
              <CardTitle className="text-slate-800">Top Selling Products</CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No sales data available</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map(([productName, data], index) => (
                    <div key={productName} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">#{index + 1}</Badge>
                        <div>
                          <h4 className="font-medium text-slate-800">{productName}</h4>
                          <p className="text-sm text-slate-600">{data.quantity} sold</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-teal-600">${data.revenue.toFixed(2)}</p>
                        {hasCostData && <p className="text-xs text-green-600">+${data.profit.toFixed(2)} profit</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Individual Sales Details */}
        <Card className="border-teal-200 mt-6">
          <CardHeader>
            <CardTitle className="text-slate-800">Individual Sales Details</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredSales.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No transactions in selected period</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {filteredSales.slice(0, 10).map((sale) => {
                  // Calculate profit for this sale (only if we have cost data)
                  const saleProfit = hasCostData
                    ? sale.items.reduce((profit, item) => {
                        const product = products.find((p) => p.id === item.product.id)
                        const unitCost = product ? product.unit_cost || 0 : 0
                        return profit + (item.product.price - unitCost) * item.quantity
                      }, 0)
                    : 0

                  return (
                    <Card key={sale.id} className="border-slate-200 bg-slate-50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-teal-100 p-2 rounded-full">
                              <User className="h-4 w-4 text-teal-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">Employee ID: {sale.employee_id}</p>
                              <p className="text-sm text-slate-600">
                                {new Date(sale.created_at).toLocaleDateString()} at{" "}
                                {new Date(sale.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-teal-600">${sale.total.toFixed(2)}</p>
                            {hasCostData && (
                              <p className="text-sm font-medium text-green-600">+${saleProfit.toFixed(2)} profit</p>
                            )}
                            <Badge
                              variant={sale.payment_method === "cash" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {sale.payment_method === "cash" ? "Cash Payment" : "School Cash"}
                            </Badge>
                          </div>
                        </div>

                        <div className="border-t pt-3">
                          <p className="text-sm font-medium text-slate-700 mb-2">Items Purchased:</p>
                          <div className="space-y-2">
                            {sale.items.map((item, index) => {
                              const product = products.find((p) => p.id === item.product.id)
                              const unitCost = product ? product.unit_cost || 0 : 0
                              const itemProfit = (item.product.price - unitCost) * item.quantity

                              return (
                                <div key={index} className="flex justify-between items-center bg-white p-2 rounded">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {item.quantity}x
                                    </Badge>
                                    <span className="text-sm text-slate-700">{item.product.name}</span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-slate-800">
                                      ${(item.product.price * item.quantity).toFixed(2)}
                                    </p>
                                    {hasCostData && (
                                      <p className="text-xs text-green-600">+${itemProfit.toFixed(2)} profit</p>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div className="border-t pt-3 mt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Transaction ID:</span>
                            <span className="text-xs font-mono text-slate-500">{sale.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cash Summary */}
        <Card className="border-teal-200 mt-6">
          <CardHeader>
            <CardTitle className="text-slate-800">Cash Register Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">Starting Cash</p>
                <p className="text-2xl font-bold text-slate-800">${startingCash.toFixed(2)}</p>
              </div>
              <div className="text-center p-4 bg-teal-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">Cash Sales Revenue</p>
                <p className="text-2xl font-bold text-teal-600">+${cashSalesAmount.toFixed(2)}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">Current Cash</p>
                <p className="text-2xl font-bold text-green-600">${currentCash.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
