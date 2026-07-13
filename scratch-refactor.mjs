import fs from 'fs';

let file = fs.readFileSync('client/src/pages/admin/AdminLeavePage.tsx', 'utf8');

// 1. Rename handlePrintLeave to generateLeaveHtml and return html
let newFile = file.replace('const handlePrintLeave = async (req: LeaveRequest) => {', 
`const generateLeaveHtml = async (req: LeaveRequest, autoPrint: boolean = false) => {`);

// 2. Change the print script part
newFile = newFile.replace(`      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>\`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
    };`, 
`      ${'${autoPrint ? \'setTimeout(function() { window.print(); }, 500);\' : \'\'}'}
    };
  </script>
</body>
</html>\`;

        return html;
    };

    const handlePrintLeave = async (req: LeaveRequest) => {
        const html = await generateLeaveHtml(req, true);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
    };

    const [viewHtml, setViewHtml] = useState<{ req: LeaveRequest, html: string } | null>(null);

    const handleViewDetail = async (req: LeaveRequest) => {
        const html = await generateLeaveHtml(req, false);
        setViewHtml({ req, html });
    };`);

// 3. Add the Eye button next to Printer button
newFile = newFile.replace(`                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="rounded-lg text-blue-600 border-blue-100 hover:bg-blue-50 h-8 w-8 p-0"
                                                            onClick={() => handlePrintLeave(req)}
                                                            title="Cetak Formulir Cuti"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </Button>`,
`                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="rounded-lg text-emerald-600 border-emerald-100 hover:bg-emerald-50 h-8 w-8 p-0"
                                                            onClick={() => handleViewDetail(req)}
                                                            title="Lihat Detail Cuti"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="rounded-lg text-blue-600 border-blue-100 hover:bg-blue-50 h-8 w-8 p-0"
                                                            onClick={() => handlePrintLeave(req)}
                                                            title="Cetak Formulir Cuti"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </Button>`);

// 4. Import Eye and Dialog/DialogContent
if (!newFile.includes('Eye,')) {
    newFile = newFile.replace('import { Loader2, Check, X, ArrowLeft, Calendar, User as UserIcon, MessageSquare, Info, Image as ImageIcon, Printer, Trash2 } from "lucide-react";', 
    'import { Loader2, Check, X, ArrowLeft, Calendar, User as UserIcon, MessageSquare, Info, Image as ImageIcon, Printer, Trash2, Eye } from "lucide-react";');
}
if (!newFile.includes('Dialog,')) {
    newFile = newFile.replace('import { Button } from "@/components/ui/button";',
    'import { Button } from "@/components/ui/button";\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";');
}

// 5. Add the Dialog UI at the end of the return statement
newFile = newFile.replace(`        </div>
    );
}`,
`            <Dialog open={!!viewHtml} onOpenChange={(open) => !open && setViewHtml(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="p-4 border-b bg-gray-50 flex-none">
                        <DialogTitle>Detail Surat Izin Cuti</DialogTitle>
                        <DialogDescription>Menampilkan format dokumen cetak cuti.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 w-full relative bg-gray-50/50 p-4 overflow-y-auto">
                        <div className="bg-white mx-auto shadow-sm border border-gray-200" style={{ maxWidth: '800px', minHeight: '100%' }}>
                            {viewHtml && (
                                <iframe 
                                    srcDoc={viewHtml.html} 
                                    className="w-full" 
                                    style={{ height: '800px', border: 'none' }} 
                                    title="View Detail"
                                />
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}`);

fs.writeFileSync('client/src/pages/admin/AdminLeavePage.tsx', newFile);
