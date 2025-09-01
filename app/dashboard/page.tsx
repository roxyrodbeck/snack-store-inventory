"use client"
import { DollarSign, Package, Clock, Plus, ShoppingCart, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { supabase, isDemoMode } from "@/lib/supabase"
import { CashRegisterManager } from "@/components/cash-register-manager"

interface Product {
  id: string
  name: string
  price: number
  quantity: number
  timeRestriction?: {
    startTime: string
    endTime: string
  }
  secondTimeRestriction?: {
    startTime: string
    endTime: string
  }
}

// Demo data for when Supabase is not available
const DEMO_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Chocolate Chip Cookies",
    price: 2.5,
    quantity: 25,
  },
  {
    id: "2",
    name: "Coca Cola",
    price: 1.5,
    quantity: 30,
  },
  {
    id: "3",
    name: "Doritos",
    price: 2.0,
    quantity: 15,
  },
  {
    id: "4",
    name: "Snickers Bar",
    price: 1.75,
    quantity: 20,
  },
]

export default function Dashboard() {
  const [employeeId, setEmployeeId] = useState("")
  const [currentCash, setCurrentCash] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [isDemoModeState, setIsDemoModeState] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem("employeeId") || ""
    const demoMode = localStorage.getItem("demoMode") === "true" || isDemoMode()
    setEmployeeId(id)
    setIsDemoModeState(demoMode)

    if (id) {
      loadData()
    } else {
      setIsLoading(false)
    }

    // Update current time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    // Set up real-time subscriptions only if not in demo mode
    let productsSubscription: any = null
    let cashSubscription: any = null

    if (!demoMode) {
      productsSubscription = supabase
        .channel("products-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
          loadProducts()
        })
        .subscribe()

      cashSubscription = supabase
        .channel("cash-register-updates")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "cash_register",
          },
          (payload) => {
            console.log("Cash register updated:", payload.new)
            setCurrentCash(payload.new.current_amount || 0)
          },
        )
        .subscribe()
    }

    return () => {
      clearInterval(timer)
      if (productsSubscription) supabase.removeChannel(productsSubscription)
      if (cashSubscription) supabase.removeChannel(cashSubscription)
    }
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    if (isDemoModeState) {
      // Load demo data
      setProducts(DEMO_PRODUCTS)
      setCurrentCash(150.0) // Demo cash amount
      setIsLoading(false)
    } else {
      await Promise.all([loadProducts(), loadCashRegister()])
      setIsLoading(false)
    }
  }

  const loadProducts = async () => {
    if (isDemoModeState) {
      setProducts(DEMO_PRODUCTS)
      return
    }

    try {
      const { data, error } = await supabase.from("products").select("*").order("name")

      if (error) throw error

      const formattedProducts: Product[] = data.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: product.quantity,
        timeRestriction:
          product.time_restriction_start && product.time_restriction_end
            ? {
                startTime: product.time_restriction_start,
                endTime: product.time_restriction_end,
              }
            : undefined,
        secondTimeRestriction:
          product.second_time_restriction_start && product.second_time_restriction_end
            ? {
                startTime: product.second_time_restriction_start,
                endTime: product.second_time_restriction_end,
              }
            : undefined,
      }))

      setProducts(formattedProducts)
    } catch (error) {
      console.error("Error loading products:", error)
      // Fallback to demo data on error
      setProducts(DEMO_PRODUCTS)
      setIsDemoModeState(true)
    }
  }

  const loadCashRegister = async () => {
    if (isDemoModeState) {
      setCurrentCash(150.0)
      return
    }

    try {
      const { data, error } = await supabase.from("cash_register").select("current_amount").single()

      if (error) {
        console.error("Error loading cash register:", error)
        // If no cash register exists, create one
        if (error.code === "PGRST116") {
          const { error: insertError } = await supabase
            .from("cash_register")
            .insert([{ current_amount: 0, starting_amount: 0, updated_by: "system" }])

          if (!insertError) {
            setCurrentCash(0)
          }
        }
        return
      }

      setCurrentCash(data.current_amount || 0)
    } catch (error) {
      console.error("Error loading cash register:", error)
      setCurrentCash(150.0) // Fallback to demo amount
    }
  }

  const isProductAvailable = (product: Product) => {
    const now = currentTime.getHours() * 60 + currentTime.getMinutes()

    let firstPeriodAvailable = true
    if (product.timeRestriction) {
      const [startHour, startMin] = product.timeRestriction.startTime.split(":").map(Number)
      const [endHour, endMin] = product.timeRestriction.endTime.split(":").map(Number)
      const startTime = startHour * 60 + startMin
      const endTime = endHour * 60 + endMin
      firstPeriodAvailable = now >= startTime && now <= endTime
    }

    let secondPeriodAvailable = true
    if (product.secondTimeRestriction) {
      const [startHour, startMin] = product.secondTimeRestriction.startTime.split(":").map(Number)
      const [endHour, endMin] = product.secondTimeRestriction.endTime.split(":").map(Number)
      const startTime = startHour * 60 + startMin
      const endTime = endHour * 60 + endMin
      secondPeriodAvailable = now >= startTime && now <= endTime
    }

    if (!product.timeRestriction && !product.secondTimeRestriction) return true
    if (product.timeRestriction && !product.secondTimeRestriction) return firstPeriodAvailable
    if (!product.timeRestriction && product.secondTimeRestriction) return secondPeriodAvailable
    return firstPeriodAvailable || secondPeriodAvailable
  }

  const availableProducts = products.filter((p) => p.quantity > 0)
  const lowStockProducts = products.filter((p) => p.quantity > 0 && p.quantity <= 5)
  const totalInventoryValue = products.reduce((sum, p) => sum + p.price * p.quantity, 0)

  const handleLogout = () => {
    localStorage.removeItem("employeeId")
    localStorage.removeItem("role")
    localStorage.removeItem("demoMode")
    window.location.href = "/"
  }

  if (!employeeId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-slate-600 mb-4">Please log in first</p>
          <Link href="/">
            <Button className="bg-teal-600 hover:bg-teal-700">Go to Login</Button>
          </Link>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-slate-600">Loading dashboard...</p>
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
            <div>
              <h1 className="text-2xl font-bold">The Snack Track</h1>
              <p className="text-teal-100">Employee ID: {employeeId}</p>
            </div>
            <div className="flex items-center gap-4">
              {isDemoModeState && (
                <Badge variant="secondary" className="bg-amber-500 text-amber-900">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Demo Mode
                </Badge>
              )}
              <div className="text-right">
                <p className="text-teal-100">Current Time</p>
                <p className="text-xl font-mono">{currentTime.toLocaleTimeString()}</p>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                Log Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Demo Mode Notice */}
        {isDemoModeState && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-amber-800">Running in Demo Mode</h3>
                  <p className="text-sm text-amber-700">
                    All data is simulated and will reset on page refresh. Set up Supabase to enable full functionality.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="border-teal-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Cash Register</CardTitle>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-teal-600" />
                {!isDemoModeState && <CashRegisterManager currentCash={currentCash} onCashUpdate={setCurrentCash} />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">${currentCash.toFixed(2)}</div>
              <p className="text-xs text-slate-500">{isDemoModeState ? "Demo amount" : "Shared across all devices"}</p>
            </CardContent>
          </Card>

          <Card className="border-teal-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Available Products</CardTitle>
              <Package className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{availableProducts.length}</div>
            </CardContent>
          </Card>

          <Card className="border-teal-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Low Stock Items</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{lowStockProducts.length}</div>
            </CardContent>
          </Card>

          <Card className="border-teal-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Inventory Value</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${totalInventoryValue.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Link href="/products">
            <Button className="w-full h-16 bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="h-5 w-5 mr-2" />
              Manage Products
            </Button>
          </Link>
          <Link href="/sales">
            <Button className="w-full h-16 bg-slate-700 hover:bg-slate-800 text-white">
              <ShoppingCart className="h-5 w-5 mr-2" />
              Make Sale
            </Button>
          </Link>

          <Link href="/reports">
            <Button className="w-full h-16 bg-teal-700 hover:bg-teal-800 text-white">
              <Clock className="h-5 w-5 mr-2" />
              View Reports
            </Button>
          </Link>
        </div>

        {/* Current Inventory */}
        <Card className="border-teal-200">
          <CardHeader>
            <CardTitle className="text-slate-800">Current Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No products added yet. Click "Manage Products" to get started.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => (
                  <Card key={product.id} className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-slate-800">{product.name}</h3>
                        <Badge variant={product.quantity <= 5 ? "destructive" : "secondary"}>
                          {product.quantity} left
                        </Badge>
                      </div>
                      <p className="text-lg font-bold text-teal-600">${product.price.toFixed(2)}</p>
                      {(product.timeRestriction || product.secondTimeRestriction) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {product.timeRestriction && (
                            <Badge variant={isProductAvailable(product) ? "default" : "outline"}>
                              {product.timeRestriction.startTime} - {product.timeRestriction.endTime}
                            </Badge>
                          )}
                          {product.secondTimeRestriction && (
                            <Badge variant={isProductAvailable(product) ? "default" : "outline"}>
                              {product.secondTimeRestriction.startTime} - {product.secondTimeRestriction.endTime}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
