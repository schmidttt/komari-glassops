/**
 * ECharts 共享配置
 *
 * 统一注册所有图表组件，避免在各个组件中重复注册
 */
import { BarChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

// 一次性注册所有需要的 ECharts 组件
use([
  BarChart,
  LineChart,
  ScatterChart,
  GraphicComponent,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  CanvasRenderer,
])
