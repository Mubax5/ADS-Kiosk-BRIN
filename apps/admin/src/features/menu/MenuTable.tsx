import type { MenuItem } from "@ads-kiosk/shared";
import { Badge, Button, LayerCard, Table } from "@cloudflare/kumo";

export function MenuTable({ items, onEdit, onDelete }: { items: MenuItem[]; onEdit(item: MenuItem): void; onDelete(item: MenuItem): void }) {
  return (
    <LayerCard className="cms-table-card">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Nama</Table.Head>
            <Table.Head>Jenis</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Urutan</Table.Head>
            <Table.Head>Aksi</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((item) => (
            <Table.Row key={item.id}>
              <Table.Cell><strong>{item.name}</strong></Table.Cell>
              <Table.Cell>{item.contentType.toUpperCase()}</Table.Cell>
              <Table.Cell><Badge>{item.active ? "Aktif" : "Nonaktif"}</Badge></Table.Cell>
              <Table.Cell>{item.sortOrder}</Table.Cell>
              <Table.Cell>
                <div className="cms-inline-actions">
                  <Button variant="secondary" onClick={() => onEdit(item)}>Edit</Button>
                  <Button variant="secondary" onClick={() => onDelete(item)}>Hapus</Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}
