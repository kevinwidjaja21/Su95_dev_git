import { AtaChapterNumber, AtaChaptersTitle, AtaChaptersDescription } from '@shared/ata';
import React from 'react';
import { Route } from 'react-router';
import { Link } from 'react-router-dom';
import { Failure } from '@flybywiresim/failures';
import { ScrollableContainer } from '../../../UtilComponents/ScrollableContainer';
import { t } from '../../../translation';
import { pathify } from '../../../Utils/routing';
import { AtaChapterPage } from './AtaChapterPage';
import { useFailuresOrchestrator } from '../../../failures-orchestrator-provider';

interface ATAChapterCardProps {
    ataNumber: AtaChapterNumber,
    title: string,
    description: string,
}

const ATAChapterCard = ({ ataNumber, description, title }: ATAChapterCardProps) => {
    const { activeFailures, allFailures } = useFailuresOrchestrator();

    const hasActiveFailure = allFailures
        .filter((it) => it.ata === ataNumber)
        .some((it) => activeFailures.has(it.identifier));

    return (
        <Link
            to={`/failures/comfort/${pathify(ataNumber.toString())}`}
            className="flex flex-row p-2 space-x-4 rounded-md border-2 border-transparent hover:border-theme-highlight transition duration-100"
        >
            <div
                className="flex justify-center items-center w-1/5 font-title text-5xl font-bold bg-theme-accent rounded-md"
            >
                {`ATA ${ataNumber}`}

                <div className="inline-block relative -right-7 bottom-16 w-0 h-0 text-utility-red fill-current">
                    {hasActiveFailure && (
                        <svg style={{ width: '30px', height: '30px' }} viewBox="0 0 20 20">
                            <circle cx={10} cy={10} r={5} />
                        </svg>
                    )}
                </div>
            </div>

            <div className="space-y-2 w-3/4">
                <h1 className="font-bold">
                    {title}
                </h1>
                <p>
                    {description}
                </p>
            </div>
        </Link>
    );
};

interface ComfortUIProps {
    filteredChapters: AtaChapterNumber[];
    allChapters: AtaChapterNumber[];
    failures: Failure[];
}

export const ComfortUI = ({ filteredChapters, allChapters, failures }: ComfortUIProps) => (
    <>
        <Route exact path="/failures/comfort">
            <ScrollableContainer height={48}>
                {filteredChapters.map((chapter) => (
                    <ATAChapterCard
                        ataNumber={chapter}
                        title={AtaChaptersTitle[chapter]}
                        description={AtaChaptersDescription[chapter]}
                    />
                ))}
            </ScrollableContainer>
            {filteredChapters.length === 0 && (
                <div className="flex justify-center items-center mt-4 rounded-md border-2 border-theme-accent" style={{ height: '48rem' }}>
                    <p>{t('Failures.NoItemsFound')}</p>
                </div>
            )}
        </Route>

        {allChapters.map((chapter) => (
            <Route path={`/failures/comfort/${chapter.toString()}`}>
                <AtaChapterPage chapter={chapter} failures={failures} />
            </Route>
        ))}
    </>
);
