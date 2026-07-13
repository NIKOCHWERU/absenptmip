const fs = require('fs');
let file = fs.readFileSync('client/src/pages/admin/EmployeeListPage.tsx', 'utf8');

const modalCode = `
function DocumentViewerModal({ employee, onClose }: { employee: User | null; onClose: () => void }) {
    const { data: documents, isLoading } = useQuery<{ name: string; url: string; type: string }[]>({
        queryKey: [\`/api/admin/users/\${employee?.id}/documents\`],
        enabled: !!employee?.id,
    });

    return (
        <Dialog open={!!employee} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Dokumen {employee?.fullName}</DialogTitle>
                    <DialogDescription>
                        Daftar dokumen yang terkait dengan tenaga kerja ini.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                    {isLoading ? (
                        <p className="text-sm text-gray-500 text-center py-4">Memuat dokumen...</p>
                    ) : documents && documents.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {documents.map((doc, i) => (
                                <Card key={i} className="shadow-sm border-gray-100 overflow-hidden">
                                    <div className="bg-gray-50 px-3 py-2 border-b text-xs font-bold text-gray-500 flex justify-between items-center">
                                        {doc.type}
                                    </div>
                                    <CardContent className="p-4 space-y-3">
                                        <p className="text-sm font-semibold line-clamp-2" title={doc.name}>{doc.name}</p>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 h-8"
                                            onClick={() => window.open(resolveFileUrl(doc.url), '_blank')}
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            Lihat File
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
                            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-500">Belum ada dokumen untuk tenaga kerja ini.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
`;

file = file.replace('// Helper Components for the Detail View', modalCode + '\n// Helper Components for the Detail View');
fs.writeFileSync('client/src/pages/admin/EmployeeListPage.tsx', file);
