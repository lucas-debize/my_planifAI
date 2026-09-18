import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import type { WeekSlot } from "@/lib/domain/slots"
import { parseISODate, toISODate, weekDays } from "@/lib/dates"
import { SLOT_LABEL, SLOTS, type SlotKind } from "@/lib/week"

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Helvetica",
    color: "#1A1614",
    flexDirection: "column",
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  week: {
    fontSize: 11,
    color: "#6B635B",
    marginBottom: 12,
  },
  table: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D7CCBB",
  },
  row: {
    flexDirection: "row",
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: "row",
    flexGrow: 0,
  },
  corner: {
    width: "12%",
    paddingVertical: 10,
    paddingHorizontal: 6,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#F4EFE6",
    borderRightWidth: 1,
    borderRightColor: "#D7CCBB",
    borderBottomWidth: 1,
    borderBottomColor: "#D7CCBB",
  },
  dayHead: {
    width: "12.571%",
    paddingVertical: 10,
    paddingHorizontal: 4,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    backgroundColor: "#F4EFE6",
    borderRightWidth: 1,
    borderRightColor: "#D7CCBB",
    borderBottomWidth: 1,
    borderBottomColor: "#D7CCBB",
  },
  mealLabel: {
    width: "12%",
    padding: 12,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#F4EFE6",
    borderRightWidth: 1,
    borderRightColor: "#D7CCBB",
    borderBottomWidth: 1,
    borderBottomColor: "#D7CCBB",
    justifyContent: "center",
  },
  mealCell: {
    width: "12.571%",
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: "#D7CCBB",
    borderBottomWidth: 1,
    borderBottomColor: "#D7CCBB",
    justifyContent: "center",
    alignItems: "center",
  },
  mealName: {
    fontSize: 12,
    textAlign: "center",
  },
  empty: {
    fontSize: 12,
    textAlign: "center",
    color: "#9A9288",
  },
})

const DAY_HEAD = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."]

function mealFor(
  slots: WeekSlot[],
  date: string,
  kind: SlotKind
): string | null {
  return (
    slots.find((slot) => slot.slot_date === date && slot.slot_kind === kind)
      ?.meal?.name ?? null
  )
}

export function WeekDocument({
  weekLabel,
  slots,
}: {
  weekLabel: string
  slots: WeekSlot[]
}) {
  const monday = parseISODate(slots[0]?.slot_date ?? "")
  const days = monday ? weekDays(monday) : []

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>PlanifIA</Text>
        <Text style={styles.week}>{weekLabel}</Text>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={styles.corner} />
            {days.map((day, index) => (
              <Text key={toISODate(day)} style={styles.dayHead}>
                {DAY_HEAD[index]} {day.getDate()}
              </Text>
            ))}
          </View>
          {SLOTS.map((kind) => (
            <View key={kind} style={styles.row}>
              <View style={styles.mealLabel}>
                <Text>{SLOT_LABEL[kind]}</Text>
              </View>
              {days.map((day) => {
                const date = toISODate(day)
                const name = mealFor(slots, date, kind)
                return (
                  <View key={`${kind}-${date}`} style={styles.mealCell}>
                    <Text style={name ? styles.mealName : styles.empty}>
                      {name ?? "—"}
                    </Text>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
