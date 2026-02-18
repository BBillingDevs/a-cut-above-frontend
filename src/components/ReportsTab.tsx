import React from "react";
import { Button, Card, Select, Space, Table, Typography } from "antd";

const { Title, Text } = Typography;

export default function ReportsTab({
  report,
  windowOptions,
  onLoadReport,
}: {
  report: any;
  windowOptions: { label: string; value: string }[];
  onLoadReport: (windowId?: string) => void;
}) {
  return (
    <Card>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Select
            placeholder="Filter by window (optional)"
            allowClear
            style={{ width: 280 }}
            options={windowOptions}
            onChange={(v) => onLoadReport(v || undefined)}
          />
          <Button onClick={() => onLoadReport(undefined)}>Clear filter</Button>
        </div>

        {report ? (
          <div>
            <DescriptionsBlock report={report} />
            <Table
              style={{ marginTop: 16 }}
              rowKey={(r) => r.name}
              dataSource={report.bestSellers || []}
              pagination={false}
              columns={[
                { title: "Best Seller", dataIndex: "name", key: "name" },
                { title: "Qty", dataIndex: "qty", key: "qty" },
              ]}
            />
          </div>
        ) : (
          <Text type="secondary">No report data.</Text>
        )}
      </Space>
    </Card>
  );
}

function DescriptionsBlock({ report }: { report: any }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 12,
      }}
    >
      <Card size="small">
        <Text type="secondary">Total Revenue</Text>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            ${Number(report.totalRevenue || 0).toFixed(2)}
          </Title>
        </div>
      </Card>

      <Card size="small">
        <Text type="secondary">Total Orders</Text>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {report.totalOrders || 0}
          </Title>
        </div>
      </Card>

      <Card size="small">
        <Text type="secondary">Generated</Text>
        <div>
          <Text>
            {report.generatedAt
              ? new Date(report.generatedAt).toLocaleString()
              : "-"}
          </Text>
        </div>
      </Card>
    </div>
  );
}
